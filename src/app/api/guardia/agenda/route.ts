import { timingSafeEqual } from "crypto";

import { NextResponse } from "next/server";

import { syncAgenda } from "@/server/services/guardia/agenda-sync";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

/**
 * Vuelta de la agenda. La llama el schedule `guardia-agenda` (vercel.json)
 * con `Authorization: Bearer CRON_SECRET`; nadie más puede.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    return NextResponse.json(await syncAgenda());
  } catch (error) {
    console.error("[guardia/agenda] Sync failed", { error });
    return NextResponse.json({ error: "SYNC_FAILED" }, { status: 500 });
  }
}
