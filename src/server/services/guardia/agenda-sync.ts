import { and, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";

import { mapWithConcurrency } from "@/lib/utils";
import { getDb, type PlutoDb } from "@/server/db";
import {
  agendaEvents,
  instances,
  syncRuns,
  tenants,
  type SyncFailure,
} from "@/server/db/schema";
import {
  fetchInstanceAgenda,
  InstanceApiError,
  type InstanceAgenda,
} from "@/server/services/guardia/instance-api";
import {
  getGuardiaInstances,
  type GuardiaInstance,
} from "@/server/services/guardia/instances";

/** La agenda mira de 12 horas atrás a 36 horas adelante. */
export const AGENDA_HOURS_BACK = 12;
export const AGENDA_HOURS_AHEAD = 36;
const INSTANCE_CONCURRENCY = 4;

export function agendaWindow(now: Date) {
  return {
    from: new Date(now.getTime() - AGENDA_HOURS_BACK * 3_600_000),
    to: new Date(now.getTime() + AGENDA_HOURS_AHEAD * 3_600_000),
  };
}

function errorMessage(error: unknown) {
  if (error instanceof InstanceApiError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

/** Prueba los dominios de la instalación, empezando por el que anduvo la última vez. */
async function readAgenda(
  instance: GuardiaInstance,
  lastBaseUrl: string | undefined,
  window: { from: Date; to: Date },
) {
  const candidates = [
    ...new Set([lastBaseUrl, ...instance.candidates].filter(Boolean)),
  ] as string[];
  if (candidates.length === 0) {
    throw new Error("No tiene un dominio de producción verificado.");
  }

  let lastError: unknown;
  for (const baseUrl of candidates) {
    try {
      return { baseUrl, agenda: await fetchInstanceAgenda(baseUrl, window) };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function storeAgenda(
  db: PlutoDb,
  instance: GuardiaInstance,
  baseUrl: string,
  agenda: InstanceAgenda,
  now: Date,
  window: { from: Date; to: Date },
) {
  return db.transaction(async (tx) => {
    const { version } = agenda.instance;
    const instanceValues = {
      name: instance.name,
      baseUrl,
      mode: agenda.instance.mode,
      commitSha: version.commitSha,
      commitRef: version.commitRef,
      deploymentId: version.deploymentId,
      lastSyncedAt: now,
      lastError: null,
      lastErrorAt: null,
      updatedAt: now,
    };
    await tx
      .insert(instances)
      .values({ id: instance.id, ...instanceValues })
      .onConflictDoUpdate({ target: instances.id, set: instanceValues });

    let eventsSeen = 0;
    const seenTenantIds: number[] = [];
    for (const tenant of agenda.tenants) {
      const [row] = await tx
        .insert(tenants)
        .values({
          instanceId: instance.id,
          slug: tenant.slug,
          name: tenant.name,
          url: tenant.url,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: [tenants.instanceId, tenants.slug],
          set: { name: tenant.name, url: tenant.url, lastSeenAt: now },
        })
        .returning({ id: tenants.id });
      seenTenantIds.push(row.id);

      for (const event of tenant.events) {
        const values = {
          slug: event.slug,
          name: event.name,
          startsAt: new Date(event.startingDate),
          endsAt: new Date(event.endingDate),
          locationName: event.locationName,
          locationAddress: event.locationAddress,
          coverImageUrl: event.coverImageUrl,
          isActive: event.isActive,
          inviteCondition: event.inviteCondition,
          lastSeenAt: now,
          goneAt: null,
        };
        await tx
          .insert(agendaEvents)
          .values({ tenantId: row.id, eventId: event.id, ...values })
          .onConflictDoUpdate({
            target: [agendaEvents.tenantId, agendaEvents.eventId],
            set: values,
          });
        eventsSeen += 1;
      }
    }

    // Lo que estaba en la ventana y ya no vino: se borró o se movió de
    // fecha. Sólo para las productoras que respondieron.
    if (seenTenantIds.length > 0) {
      await tx
        .update(agendaEvents)
        .set({ goneAt: now })
        .where(
          and(
            inArray(agendaEvents.tenantId, seenTenantIds),
            isNull(agendaEvents.goneAt),
            lt(agendaEvents.lastSeenAt, now),
            lte(agendaEvents.startsAt, window.to),
            gte(agendaEvents.endsAt, window.from),
          ),
        );
    }

    return eventsSeen;
  });
}

export type AgendaSyncSummary = {
  runId: number;
  instancesOk: number;
  instancesFailed: number;
  eventsSeen: number;
  failures: SyncFailure[];
};

/**
 * Una vuelta de la agenda: le pregunta a cada instalación qué eventos tiene en
 * la ventana y lo guarda. Una instalación que falla no frena a las demás.
 */
export async function syncAgenda(now = new Date()): Promise<AgendaSyncSummary> {
  const db = getDb();
  const window = agendaWindow(now);
  const [run] = await db
    .insert(syncRuns)
    .values({ kind: "agenda", startedAt: now })
    .returning({ id: syncRuns.id });

  const guardiaInstances = await getGuardiaInstances();
  const known =
    guardiaInstances.length === 0
      ? []
      : await db
          .select({ id: instances.id, baseUrl: instances.baseUrl })
          .from(instances)
          .where(
            inArray(
              instances.id,
              guardiaInstances.map((instance) => instance.id),
            ),
          );
  const lastBaseUrl = new Map(known.map((row) => [row.id, row.baseUrl]));

  const results = await mapWithConcurrency(
    guardiaInstances,
    INSTANCE_CONCURRENCY,
    async (instance) => {
      try {
        const { baseUrl, agenda } = await readAgenda(
          instance,
          lastBaseUrl.get(instance.id),
          window,
        );
        const eventsSeen = await storeAgenda(
          db,
          instance,
          baseUrl,
          agenda,
          now,
          window,
        );
        const tenantFailures = agenda.failedTenants.map((tenant) => ({
          instanceId: instance.id,
          name: `${instance.name} / ${tenant.name}`,
          error: "La productora no respondió.",
        }));
        return { ok: true as const, eventsSeen, failures: tenantFailures };
      } catch (error) {
        const message = errorMessage(error);
        console.error("[guardia/agenda] Instance failed", {
          instance: instance.name,
          error: message,
        });
        const failed = {
          name: instance.name,
          lastError: message,
          lastErrorAt: now,
          updatedAt: now,
        };
        await db
          .insert(instances)
          .values({
            id: instance.id,
            baseUrl:
              lastBaseUrl.get(instance.id) ?? instance.candidates[0] ?? "",
            ...failed,
          })
          .onConflictDoUpdate({ target: instances.id, set: failed });
        return {
          ok: false as const,
          eventsSeen: 0,
          failures: [
            { instanceId: instance.id, name: instance.name, error: message },
          ],
        };
      }
    },
  );

  const summary = {
    runId: run.id,
    instancesOk: results.filter((result) => result.ok).length,
    instancesFailed: results.filter((result) => !result.ok).length,
    eventsSeen: results.reduce((total, result) => total + result.eventsSeen, 0),
    failures: results.flatMap((result) => result.failures),
  };

  await db
    .update(syncRuns)
    .set({
      finishedAt: sql`now()`,
      instancesOk: summary.instancesOk,
      instancesFailed: summary.instancesFailed,
      eventsSeen: summary.eventsSeen,
      failures: summary.failures,
    })
    .where(eq(syncRuns.id, run.id));

  return summary;
}
