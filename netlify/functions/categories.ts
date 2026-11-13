import { eq, inArray } from "drizzle-orm";
import type { Context, HandlerEvent, HandlerResponse } from "@netlify/functions";
import { categories, products } from "../../db/schema";
import { getDb } from "./lib/db";
import { withAdminAuth } from "./lib/auth";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  methodNotAllowed,
  optionalText,
  publicErrorResponse,
  publicJsonResponse,
  publicOptionsResponse,
  readJsonBody,
  requiredText,
  toResponse,
} from "./lib/http";

function serializeCategory(category: typeof categories.$inferSelect) {
  return {
    id: category.id,
    name: category.name,
    description: category.description ?? "",
  };
}

async function saveCategory(event: HandlerEvent, isNew: boolean) {
  const body = await readJsonBody(event);
  const id = requiredText(body, "id", 100);
  const values = {
    name: requiredText(body, "name", 80),
    description: optionalText(body, "description", 300),
  };
  const db = getDb();
  const existingCategories = await db.select().from(categories);
  if (
    existingCategories.some(
      (category) =>
        category.id !== id &&
        category.name.trim().toLocaleLowerCase("pt-BR") ===
          values.name.toLocaleLowerCase("pt-BR"),
    )
  ) {
    throw new HttpError(409, "CATEGORY_NAME_EXISTS", "Já existe uma categoria com esse nome.");
  }

  if (isNew) {
    const [created] = await db
      .insert(categories)
      .values({ id, ...values })
      .onConflictDoNothing()
      .returning();
    if (!created) throw new HttpError(409, "CATEGORY_EXISTS", "Esta categoria já existe.");
    return jsonResponse(201, { data: serializeCategory(created) });
  }

  const [updated] = await db
    .update(categories)
    .set(values)
    .where(eq(categories.id, id))
    .returning();
  if (!updated) throw new HttpError(404, "CATEGORY_NOT_FOUND", "Categoria não encontrada.");
  return jsonResponse(200, { data: serializeCategory(updated) });
}

const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  try {
    const db = getDb();
    switch (event.httpMethod) {
      case "GET": {
        const rows = await db.select().from(categories);
        return jsonResponse(200, { data: rows.map(serializeCategory) });
      }
      case "POST":
        return await saveCategory(event, true);
      case "PUT":
        return await saveCategory(event, false);
      case "DELETE": {
        const id = event.queryStringParameters?.id;
        if (!id) throw new HttpError(400, "INVALID_ID", "Informe o ID da categoria.");
        const [linkedProduct] = await db
          .select({ id: products.id })
          .from(products)
          .where(eq(products.categoryId, id))
          .limit(1);
        if (linkedProduct) {
          throw new HttpError(
            409,
            "CATEGORY_IN_USE",
            "Não é possível excluir uma categoria que ainda possui produtos.",
          );
        }
        const [deleted] = await db
          .delete(categories)
          .where(eq(categories.id, id))
          .returning({ id: categories.id });
        if (!deleted) throw new HttpError(404, "CATEGORY_NOT_FOUND", "Categoria não encontrada.");
        return jsonResponse(200, { data: deleted });
      }
      default:
        return methodNotAllowed("GET, POST, PUT, DELETE");
    }
  } catch (error) {
    return errorResponse(error);
  }
};

const adminHandler = withAdminAuth(handler);

export default async (request: Request, context: Context): Promise<Response> => {
  if (request.method === "OPTIONS") return toResponse(publicOptionsResponse());

  const isAdminView = new URL(request.url).searchParams.get("view") === "admin";
  if (request.method === "GET" && !isAdminView) {
    try {
      const db = getDb();
      const linkedCategories = await db
        .select({ id: products.categoryId })
        .from(products)
        .where(eq(products.status, "active"));
      const categoryIds = [...new Set(
        linkedCategories
          .map(({ id }) => id)
          .filter((id): id is string => id !== null),
      )];
      const rows = categoryIds.length
        ? await db.select().from(categories).where(inArray(categories.id, categoryIds))
        : [];
      return toResponse(publicJsonResponse(200, { data: rows.map(serializeCategory) }));
    } catch (error) {
      return toResponse(publicErrorResponse(error));
    }
  }

  return adminHandler(request, context);
};
