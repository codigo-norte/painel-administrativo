import { getUser } from "@netlify/identity";
import type { Context, HandlerEvent, HandlerResponse } from "@netlify/functions";
import { errorResponse, jsonResponse, toResponse } from "./http";

type LegacyHandler = (event: HandlerEvent) => Promise<HandlerResponse>;

export async function getAdminAuthorizationResponse(
  request?: Request,
): Promise<Response | null> {
  const user = await getUser();
  if (!user) {
    return toResponse(
      jsonResponse(401, {
        error: { code: "UNAUTHORIZED", message: "Autenticação necessária." },
      }),
    );
  }
  if (!user.roles?.includes("admin")) {
    return toResponse(
      jsonResponse(403, {
        error: { code: "FORBIDDEN", message: "Acesso restrito ao administrador." },
      }),
    );
  }
  if (request && ["POST", "PUT", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return toResponse(
        jsonResponse(403, {
          error: { code: "INVALID_ORIGIN", message: "A origem da requisição não é permitida." },
        }),
      );
    }
  }
  return null;
}

async function toHandlerEvent(request: Request): Promise<HandlerEvent> {
  const url = new URL(request.url);
  const queryStringParameters: Record<string, string> = {};
  const multiValueQueryStringParameters: Record<string, string[]> = {};
  for (const [name, value] of url.searchParams) {
    queryStringParameters[name] = value;
    (multiValueQueryStringParameters[name] ??= []).push(value);
  }

  return {
    rawUrl: request.url,
    rawQuery: url.search.slice(1),
    path: url.pathname,
    httpMethod: request.method,
    headers: Object.fromEntries(request.headers),
    multiValueHeaders: {},
    queryStringParameters,
    multiValueQueryStringParameters,
    body: await request.text(),
    isBase64Encoded: false,
  };
}

export function withAdminAuth(handler: LegacyHandler) {
  return async (request: Request, _context: Context): Promise<Response> => {
    try {
      const authorizationResponse = await getAdminAuthorizationResponse(request);
      if (authorizationResponse) return authorizationResponse;

      return toResponse(await handler(await toHandlerEvent(request)));
    } catch (error) {
      return toResponse(errorResponse(error));
    }
  };
}
