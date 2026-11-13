import type { HandlerEvent, HandlerResponse } from "@netlify/functions";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonResponse(
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): HandlerResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function publicReadHeaders(allowedMethods: string) {
  return {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": allowedMethods,
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  Vary: "Origin",
  };
}

export function publicJsonResponse(
  statusCode: number,
  body: unknown,
  allowedMethods = "GET, OPTIONS",
): HandlerResponse {
  return jsonResponse(statusCode, body, publicReadHeaders(allowedMethods));
}

export function publicOptionsResponse(allowedMethods = "GET, OPTIONS"): HandlerResponse {
  return {
    statusCode: 204,
    headers: publicReadHeaders(allowedMethods),
  };
}

export function publicErrorResponse(error: unknown, allowedMethods = "GET, OPTIONS"): HandlerResponse {
  const response = errorResponse(error);
  return {
    ...response,
    headers: { ...response.headers, ...publicReadHeaders(allowedMethods) },
  };
}

export function toResponse(response: HandlerResponse): Response {
  const headers = new Headers();
  for (const [name, value] of Object.entries(response.headers ?? {})) {
    headers.set(name, String(value));
  }
  for (const [name, values] of Object.entries(response.multiValueHeaders ?? {})) {
    for (const value of values) headers.append(name, String(value));
  }
  return new Response(response.body ?? null, {
    status: response.statusCode,
    headers,
  });
}

export function methodNotAllowed(allow: string): HandlerResponse {
  return jsonResponse(
    405,
    { error: { code: "METHOD_NOT_ALLOWED", message: "Método não permitido." } },
    { Allow: allow },
  );
}

export async function readJsonBody(event: HandlerEvent): Promise<Record<string, unknown>> {
  if (!event.body) {
    throw new HttpError(400, "INVALID_BODY", "Envie um corpo JSON.");
  }

  let parsed: unknown;
  try {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    parsed = JSON.parse(body);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "O corpo da requisição não contém JSON válido.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new HttpError(400, "INVALID_BODY", "Envie um objeto JSON.");
  }

  return parsed as Record<string, unknown>;
}

export function requiredText(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
  allowEmpty = false,
): string {
  const value = body[field];
  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_FIELD", `O campo "${field}" precisa ser um texto.`);
  }

  const normalized = value.trim();
  if ((!allowEmpty && !normalized) || normalized.length > maxLength) {
    throw new HttpError(
      400,
      "INVALID_FIELD",
      `O campo "${field}" precisa ter ${allowEmpty ? "até" : "entre 1 e"} ${maxLength} caracteres.`,
    );
  }
  return normalized;
}

export function optionalText(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
): string {
  if (body[field] === undefined || body[field] === null) return "";
  return requiredText(body, field, maxLength, true);
}

export function errorResponse(error: unknown): HandlerResponse {
  if (error instanceof HttpError) {
    return jsonResponse(error.statusCode, {
      error: { code: error.code, message: error.message },
    });
  }

  console.error("Netlify Function failed:", error);
  return jsonResponse(500, {
    error: {
      code: "INTERNAL_ERROR",
      message: "Ocorreu um erro interno. Tente novamente.",
    },
  });
}
