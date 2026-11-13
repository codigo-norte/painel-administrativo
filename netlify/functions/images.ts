import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import type { Context } from "@netlify/functions";
import { getAdminAuthorizationResponse } from "./lib/auth";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  methodNotAllowed,
  publicErrorResponse,
  publicJsonResponse,
  publicOptionsResponse,
  toResponse,
} from "./lib/http";

const IMAGE_PREFIX = "image/";
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const imageStore = () => getStore("panel-images");

function imageId(value: string | null): string {
  if (!value || !uuidPattern.test(value)) {
    throw new HttpError(400, "INVALID_IMAGE_ID", "Informe um identificador de imagem válido.");
  }
  return value;
}

function imageUrl(request: Request, id: string): string {
  const url = new URL("/.netlify/functions/images", request.url);
  url.searchParams.set("id", id);
  return url.href;
}

function detectContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  const header = String.fromCharCode(...bytes.slice(0, 12));
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") return "image/webp";
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) return "image/gif";
  return null;
}

async function listImages(request: Request): Promise<Response> {
  const { blobs } = await imageStore().list({ prefix: IMAGE_PREFIX });
  const images = blobs
    .map(({ key }) => key.slice(IMAGE_PREFIX.length))
    .filter((id) => uuidPattern.test(id))
    .map((id) => ({ id, url: imageUrl(request, id) }));
  return toResponse(publicJsonResponse(200, { data: images }));
}

async function getImage(request: Request, id: string): Promise<Response> {
  const key = `${IMAGE_PREFIX}${id}`;
  const entry = await imageStore().getWithMetadata(key, { type: "arrayBuffer" });
  if (!entry || !entry.data) {
    return toResponse(publicJsonResponse(404, {
      error: { code: "IMAGE_NOT_FOUND", message: "Imagem não encontrada." },
    }));
  }

  const contentType = entry.metadata.contentType;
  if (typeof contentType !== "string" || !allowedContentTypes.has(contentType)) {
    throw new HttpError(500, "INVALID_IMAGE_METADATA", "Não foi possível validar esta imagem.");
  }
  return new Response(entry.data, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, immutable",
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
    },
  });
}

async function saveImage(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, "INVALID_MULTIPART", "Envie o arquivo como formulário multipart.");
  }
  const file = form.get("image");
  if (!(file instanceof File)) {
    throw new HttpError(400, "IMAGE_REQUIRED", "Selecione um arquivo de imagem.");
  }
  if (!file.size || file.size > MAX_FILE_SIZE) {
    throw new HttpError(413, "IMAGE_TOO_LARGE", "A imagem precisa ter entre 1 byte e 4 MB.");
  }

  const buffer = await file.arrayBuffer();
  const contentType = detectContentType(new Uint8Array(buffer));
  if (!contentType) {
    throw new HttpError(415, "UNSUPPORTED_IMAGE_TYPE", "Envie uma imagem JPEG, PNG, WebP ou GIF válida.");
  }

  const id = randomUUID();
  await imageStore().set(`${IMAGE_PREFIX}${id}`, buffer, {
    metadata: { contentType },
  });
  return toResponse(jsonResponse(201, {
    data: { id, url: imageUrl(request, id) },
  }));
}

export default async (request: Request, context: Context): Promise<Response> => {
  if (request.method === "OPTIONS") return toResponse(publicOptionsResponse());

  if (request.method === "GET") {
    try {
      const params = new URL(request.url).searchParams;
      return params.has("id")
        ? await getImage(request, imageId(params.get("id")))
        : await listImages(request);
    } catch (error) {
      return toResponse(publicErrorResponse(error));
    }
  }

  if (request.method !== "POST" && request.method !== "DELETE") {
    return toResponse(methodNotAllowed("GET, POST, DELETE"));
  }

  try {
    const authorizationResponse = await getAdminAuthorizationResponse(request);
    if (authorizationResponse) return authorizationResponse;
    if (request.method === "POST") return await saveImage(request);

    const id = imageId(new URL(request.url).searchParams.get("id"));
    const existing = await imageStore().getMetadata(`${IMAGE_PREFIX}${id}`);
    if (!existing) {
      return toResponse(jsonResponse(404, {
        error: { code: "IMAGE_NOT_FOUND", message: "Imagem não encontrada." },
      }));
    }
    await imageStore().delete(`${IMAGE_PREFIX}${id}`);
    return toResponse(jsonResponse(200, { data: { id } }));
  } catch (error) {
    return toResponse(errorResponse(error));
  }
};
