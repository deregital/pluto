import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/server/db/schema";

let db: ReturnType<typeof createDb> | undefined;

function createDb(connectionString: string) {
  const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 5_000 });
  // En Vercel, cierra las conexiones ociosas antes de que la función se suspenda.
  attachDatabasePool(pool);
  return drizzle(pool, { schema });
}

export function getDb() {
  if (!db) {
    const url = process.env.PLUTO_DATABASE_URL?.trim();
    if (!url) throw new Error("PLUTO_DATABASE_URL is not configured");
    db = createDb(url);
  }
  return db;
}

export type PlutoDb = ReturnType<typeof getDb>;
