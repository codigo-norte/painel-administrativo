import type { HandlerEvent, HandlerResponse } from "@netlify/functions";
import { errorResponse, jsonResponse, methodNotAllowed, readJsonBody, requiredText } from "./lib/http";
import { emptyAccount, readAccount, writeAccount } from "./lib/single-record";
import { withAdminAuth } from "./lib/auth";

const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  try {
    if (event.httpMethod === "GET") {
      return jsonResponse(200, { data: await readAccount() });
    }
    if (event.httpMethod !== "PUT") return methodNotAllowed("GET, PUT");

    const body = await readJsonBody(event);
    const values = {
      name: requiredText(body, "name", 80),
      email: requiredText(body, "email", 150, true),
    };
    const saved = await writeAccount({ ...emptyAccount, ...values });
    return jsonResponse(200, { data: saved });
  } catch (error) {
    return errorResponse(error);
  }
};

export default withAdminAuth(handler);
