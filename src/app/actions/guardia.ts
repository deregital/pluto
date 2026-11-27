"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/server/auth";
import { syncAgenda } from "@/server/services/guardia/agenda-sync";

/** "Leer agenda ahora" del tablero: la misma vuelta que corre el schedule. */
export async function syncAgendaNow() {
  const session = await auth();
  if (!session) throw new Error("UNAUTHORIZED");

  const summary = await syncAgenda();
  revalidatePath("/tonight");
  return {
    instancesOk: summary.instancesOk,
    instancesFailed: summary.instancesFailed,
    eventsSeen: summary.eventsSeen,
  };
}
