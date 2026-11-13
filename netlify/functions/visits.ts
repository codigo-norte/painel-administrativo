import type { Context, HandlerEvent, HandlerResponse } from "@netlify/functions";
import { asc, and, gte, lte, sql } from "drizzle-orm";
import { siteVisits } from "../../db/schema";
import { getDb } from "./lib/db";
import { getAdminAuthorizationResponse, withAdminAuth } from "./lib/auth";
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

function getDailyDates(days: number) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) =>
    new Date(today.getTime() - (days - index - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10),
  );
}

async function recordVisit() {
  const visitDate = new Date().toISOString().slice(0, 10);
  await getDb()
    .insert(siteVisits)
    .values({ visitDate, visits: 1 })
    .onConflictDoUpdate({
      target: siteVisits.visitDate,
      set: { visits: sql`${siteVisits.visits} + 1` },
    });
}

const adminHandler = withAdminAuth(async (event: HandlerEvent): Promise<HandlerResponse> => {
  const rawDays = event.queryStringParameters?.days;
  const days = rawDays === undefined ? 30 : Number(rawDays);
  if (![7, 30, 90].includes(days)) {
    throw new HttpError(400, "INVALID_PERIOD", "O período precisa ser 7, 30 ou 90 dias.");
  }

  const dates = getDailyDates(days);
  const rows = await getDb()
    .select({ date: siteVisits.visitDate, visits: siteVisits.visits })
    .from(siteVisits)
    .where(and(gte(siteVisits.visitDate, dates[0]), lte(siteVisits.visitDate, dates[dates.length - 1])))
    .orderBy(asc(siteVisits.visitDate));
  const counts = new Map(rows.map((row) => [row.date, Number(row.visits)]));
  return jsonResponse(200, {
    data: dates.map((date) => ({ date, visits: counts.get(date) ?? 0 })),
  });
});

export default async (request: Request, context: Context): Promise<Response> => {
  const methods = "GET, POST, OPTIONS";
  if (request.method === "OPTIONS") {
    return toResponse(publicOptionsResponse(methods));
  }

  if (request.method === "POST") {
    try {
      if (request.body) {
        throw new HttpError(400, "INVALID_BODY", "O registro de page view não aceita corpo.");
      }
      await recordVisit();
      return toResponse(publicJsonResponse(202, { data: { recorded: true } }, methods));
    } catch (error) {
      return toResponse(publicErrorResponse(error, methods));
    }
  }

  if (request.method === "GET") return adminHandler(request, context);

  try {
    const authorizationResponse = await getAdminAuthorizationResponse(request);
    if (authorizationResponse) return authorizationResponse;
    return toResponse(methodNotAllowed("GET, POST"));
  } catch (error) {
    return toResponse(errorResponse(error));
  }
};
