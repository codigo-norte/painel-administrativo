import { getDatabase } from "@netlify/database";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import * as schema from "../../../db/schema";

type Database =
  | ReturnType<typeof drizzleNeon<typeof schema>>
  | ReturnType<typeof drizzleNodePostgres<typeof schema>>;

let database: Database | undefined;

export function getDb(): Database {
  if (!database) {
    const connection = getDatabase();
    database =
      connection.driver === "serverless"
        ? drizzleNeon({ client: connection.httpClient, schema })
        : drizzleNodePostgres({ client: connection.pool, schema });
  }
  return database;
}
