import type { Context, HandlerEvent, HandlerResponse } from "@netlify/functions";
import {
  errorResponse,
  jsonResponse,
  methodNotAllowed,
  publicErrorResponse,
  publicJsonResponse,
  publicOptionsResponse,
  readJsonBody,
  requiredText,
  toResponse,
} from "./lib/http";
import { emptyCompany, readCompany, writeCompany } from "./lib/single-record";
import { withAdminAuth } from "./lib/auth";

const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  try {
    if (event.httpMethod === "GET") {
      return jsonResponse(200, { data: await readCompany() });
    }
    if (event.httpMethod !== "PUT") return methodNotAllowed("GET, PUT");

    const body = await readJsonBody(event);
    const values = {
      name: requiredText(body, "name", 100),
      website: requiredText(body, "website", 200, true),
      email: requiredText(body, "email", 150, true),
      phone: requiredText(body, "phone", 30, true),
      address: requiredText(body, "address", 180, true),
      about: requiredText(body, "about", 1000, true),
    };
    const saved = await writeCompany({ ...emptyCompany, ...values });
    return jsonResponse(200, { data: saved });
  } catch (error) {
    return errorResponse(error);
  }
};

const adminHandler = withAdminAuth(handler);

export default async (request: Request, context: Context): Promise<Response> => {
  if (request.method === "OPTIONS") return toResponse(publicOptionsResponse());
  if (request.method === "GET") {
    try {
      return toResponse(publicJsonResponse(200, { data: await readCompany() }));
    } catch (error) {
      return toResponse(publicErrorResponse(error));
    }
  }
  return adminHandler(request, context);
};
