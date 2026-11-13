import { eq } from "drizzle-orm";
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

function serializeProduct(product: typeof products.$inferSelect) {
  return {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId ?? "",
    price: Number(product.price),
    description: product.description ?? "",
    status: product.status,
  };
}

async function saveProduct(event: HandlerEvent, isNew: boolean) {
  const body = await readJsonBody(event);
  const id = requiredText(body, "id", 100);
  const name = requiredText(body, "name", 100);
  const categoryId = optionalText(body, "categoryId", 100);
  const description = optionalText(body, "description", 500);
  const status = requiredText(body, "status", 20);
  const price = body.price;

  if (typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > 99999999.99) {
    throw new HttpError(400, "INVALID_PRICE", "Informe um preço válido.");
  }
  if (status !== "active" && status !== "inactive") {
    throw new HttpError(400, "INVALID_STATUS", "O status precisa ser active ou inactive.");
  }

  const db = getDb();
  if (categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);
    if (!category) throw new HttpError(400, "CATEGORY_NOT_FOUND", "A categoria selecionada não existe.");
  }

  const values = {
    name,
    categoryId: categoryId || null,
    price: price.toFixed(2),
    description,
    status,
  };

  if (isNew) {
    const [created] = await db
      .insert(products)
      .values({ id, ...values })
      .onConflictDoNothing()
      .returning();
    if (!created) throw new HttpError(409, "PRODUCT_EXISTS", "Este produto já existe.");
    return jsonResponse(201, { data: serializeProduct(created) });
  }

  const [updated] = await db
    .update(products)
    .set(values)
    .where(eq(products.id, id))
    .returning();
  if (!updated) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Produto não encontrado.");
  return jsonResponse(200, { data: serializeProduct(updated) });
}

const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  try {
    const db = getDb();
    switch (event.httpMethod) {
      case "GET": {
        const rows = await db.select().from(products);
        return jsonResponse(200, { data: rows.map(serializeProduct) });
      }
      case "POST":
        return await saveProduct(event, true);
      case "PUT":
        return await saveProduct(event, false);
      case "DELETE": {
        const id = event.queryStringParameters?.id;
        if (!id) throw new HttpError(400, "INVALID_ID", "Informe o ID do produto.");
        const [deleted] = await db
          .delete(products)
          .where(eq(products.id, id))
          .returning({ id: products.id });
        if (!deleted) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Produto não encontrado.");
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
      const rows = await getDb()
        .select()
        .from(products)
        .where(eq(products.status, "active"));
      return toResponse(publicJsonResponse(200, { data: rows.map(serializeProduct) }));
    } catch (error) {
      return toResponse(publicErrorResponse(error));
    }
  }

  return adminHandler(request, context);
};