import { and, asc, desc, eq, gte, lte } from "drizzle-orm";

import { mapWithConcurrency } from "@/lib/utils";
import { getDb } from "@/server/db";
import { agendaEvents, instances, syncRuns, tenants } from "@/server/db/schema";
import {
  fetchNightMetrics,
  InstanceApiError,
  MAX_EVENTS_PER_METRICS_REQUEST,
  type NightMetrics,
} from "@/server/services/guardia/instance-api";

/**
 * El tablero "Noches de hoy": las noches de la agenda que empiezan en las
 * próximas 18 horas o terminaron hace menos de 2, con sus métricas en vivo.
 * Todo llega formateado (hora de Argentina) para que el navegador no tenga
 * que calcular nada con su propia zona horaria.
 */

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const HOURS_AHEAD = 18;
const HOURS_AFTER_END = 2;
const MAX_BARS = 36;

const timeFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dayParts = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "numeric",
});
/** "vie 27/11", en la hora de Argentina. */
function formatDay(date: Date) {
  const parts = Object.fromEntries(
    dayParts.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.weekday} ${parts.day}/${parts.month}`;
}
const clockFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const METRICS_ERRORS: Record<string, string> = {
  EVENT_NOT_FOUND:
    "La instalación no encuentra el evento: puede que lo hayan borrado.",
  TENANT_NOT_FOUND: "La productora ya no está activa en su instalación.",
  DATA_UNAVAILABLE: "La base de la productora no respondió.",
};

export type NightState = "live" | "upcoming" | "ended";

export type TonightNight = {
  key: string;
  name: string;
  tenantName: string;
  instanceName: string;
  adminUrl: string;
  timeLabel: string;
  state: NightState;
  /** "en 3 h 20 min" para las que no empezaron. */
  startsInLabel: string | null;
  gone: boolean;
  /** Una noche con venta que no está publicada en la ticketera. */
  unpublished: boolean;
  error: string | null;
  metrics: {
    valid: number;
    entered: number;
    pending: number;
    percent: number;
    last10Minutes: number;
    lastEntryLabel: string;
    organizers: { valid: number; entered: number };
    unpaid: number;
    scannedOutsideWindow: number;
    bars: { label: string; entries: number }[];
    bucketMinutes: number;
  } | null;
};

export type TonightBoard = {
  generatedAtLabel: string;
  agenda: {
    lastRunLabel: string | null;
    failures: { name: string; error: string }[];
  };
  totals: {
    live: number;
    upcoming: number;
    entered: number;
    pending: number;
    last10Minutes: number;
  };
  nights: TonightNight[];
  instances: {
    id: string;
    name: string;
    modeLabel: string;
    versionLabel: string;
    lastSyncLabel: string;
    error: string | null;
  }[];
};

export function formatAgo(date: Date | null, now: Date) {
  if (!date) return "nunca";
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - date.getTime()) / 60_000),
  );
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
}

function formatIn(date: Date, now: Date) {
  const minutes = Math.max(
    0,
    Math.round((date.getTime() - now.getTime()) / 60_000),
  );
  if (minutes < 60) return `en ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `en ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
}

function sameArgentinaDay(a: Date, b: Date) {
  return formatDay(a) === formatDay(b);
}

function timeLabel(startsAt: Date, endsAt: Date, now: Date) {
  const range = `${timeFormat.format(startsAt)} a ${timeFormat.format(endsAt)}`;
  return sameArgentinaDay(startsAt, now)
    ? range
    : `${formatDay(startsAt)}, ${range}`;
}

function nightState(startsAt: Date, endsAt: Date, now: Date): NightState {
  if (now < startsAt) return "upcoming";
  if (now > endsAt) return "ended";
  return "live";
}

/** Ingresos agrupados en barras de 5, 10, 15… minutos, como mucho MAX_BARS. */
export function entryBars(
  entriesPerMinute: NightMetrics["entriesPerMinute"],
  startsAt: Date,
  endsAt: Date,
  now: Date,
) {
  const firstEntry = entriesPerMinute[0]
    ? new Date(entriesPerMinute[0].minute)
    : null;
  const start = new Date(
    Math.max(
      startsAt.getTime() - 60 * 60_000,
      Math.min(startsAt.getTime(), firstEntry?.getTime() ?? startsAt.getTime()),
    ),
  );
  const end = new Date(
    Math.min(now.getTime(), endsAt.getTime() + 2 * 3_600_000),
  );
  const totalMinutes = Math.max(0, (end.getTime() - start.getTime()) / 60_000);
  const bucketMinutes = Math.max(5, Math.ceil(totalMinutes / MAX_BARS / 5) * 5);
  const count = Math.max(1, Math.ceil(totalMinutes / bucketMinutes));

  const bars = Array.from({ length: count }, (_, index) => {
    const bucketStart = new Date(
      start.getTime() + index * bucketMinutes * 60_000,
    );
    return { label: timeFormat.format(bucketStart), entries: 0 };
  });
  for (const { minute, entries } of entriesPerMinute) {
    const index = Math.floor(
      (new Date(minute).getTime() - start.getTime()) / (bucketMinutes * 60_000),
    );
    if (index >= 0 && index < bars.length) bars[index].entries += entries;
  }
  return { bars, bucketMinutes };
}

function summarize(
  metrics: NightMetrics,
  startsAt: Date,
  endsAt: Date,
  now: Date,
): NonNullable<TonightNight["metrics"]> {
  const tenMinutesAgo = now.getTime() - 10 * 60_000;
  const { valid, entered, pending, scannedOutsideWindow } = metrics.tickets;
  return {
    valid,
    entered,
    pending,
    percent: valid > 0 ? Math.round((entered / valid) * 100) : 0,
    last10Minutes: metrics.entriesPerMinute
      .filter((row) => new Date(row.minute).getTime() >= tenMinutesAgo)
      .reduce((total, row) => total + row.entries, 0),
    lastEntryLabel: metrics.lastEntryAt
      ? formatAgo(new Date(metrics.lastEntryAt), now)
      : "todavía nadie",
    organizers: metrics.organizers,
    unpaid:
      metrics.unpaid.mercadoPago +
      metrics.unpaid.transfer +
      metrics.unpaid.checkout +
      metrics.unpaid.other,
    scannedOutsideWindow,
    ...entryBars(metrics.entriesPerMinute, startsAt, endsAt, now),
  };
}

function versionLabel(row: {
  commitSha: string | null;
  commitRef: string | null;
}) {
  if (!row.commitSha) return "sin dato";
  const sha = row.commitSha.slice(0, 7);
  return row.commitRef ? `${sha} (${row.commitRef})` : sha;
}

export async function getTonightBoard(now = new Date()): Promise<TonightBoard> {
  const db = getDb();
  const from = new Date(now.getTime() - HOURS_AFTER_END * 3_600_000);
  const to = new Date(now.getTime() + HOURS_AHEAD * 3_600_000);

  const [rows, [lastRun], instanceRows] = await Promise.all([
    db
      .select({ event: agendaEvents, tenant: tenants, instance: instances })
      .from(agendaEvents)
      .innerJoin(tenants, eq(tenants.id, agendaEvents.tenantId))
      .innerJoin(instances, eq(instances.id, tenants.instanceId))
      .where(
        and(lte(agendaEvents.startsAt, to), gte(agendaEvents.endsAt, from)),
      )
      .orderBy(asc(agendaEvents.startsAt), asc(agendaEvents.name)),
    db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.kind, "agenda"))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1),
    // Las que la agenda tocó en el último día: una que salió de Vercel deja de verse.
    db
      .select()
      .from(instances)
      .where(gte(instances.updatedAt, new Date(now.getTime() - 24 * 3_600_000)))
      .orderBy(asc(instances.name)),
  ]);

  // Una tanda de métricas por instalación (hasta 50 noches por pedido).
  const metricsByKey = new Map<string, NightMetrics | string>();
  const byInstance = new Map<string, typeof rows>();
  for (const row of rows) {
    byInstance.set(row.instance.id, [
      ...(byInstance.get(row.instance.id) ?? []),
      row,
    ]);
  }
  await mapWithConcurrency(
    [...byInstance.values()],
    4,
    async (instanceRows) => {
      const { baseUrl } = instanceRows[0].instance;
      for (
        let i = 0;
        i < instanceRows.length;
        i += MAX_EVENTS_PER_METRICS_REQUEST
      ) {
        const chunk = instanceRows.slice(i, i + MAX_EVENTS_PER_METRICS_REQUEST);
        try {
          const response = await fetchNightMetrics(
            baseUrl,
            chunk.map((row) => ({
              tenant: row.tenant.slug,
              eventId: row.event.eventId,
            })),
          );
          for (const result of response.results) {
            const key = `${instanceRows[0].instance.id}|${result.tenant}|${result.eventId}`;
            metricsByKey.set(
              key,
              "metrics" in result
                ? result.metrics
                : (METRICS_ERRORS[result.error] ??
                    `La instalación respondió ${result.error}.`),
            );
          }
        } catch (error) {
          const message =
            error instanceof InstanceApiError
              ? error.message
              : "No se pudieron leer las métricas.";
          for (const row of chunk) {
            metricsByKey.set(
              `${row.instance.id}|${row.tenant.slug}|${row.event.eventId}`,
              message,
            );
          }
        }
      }
    },
  );

  const nights: TonightNight[] = rows.map(({ event, tenant, instance }) => {
    const key = `${instance.id}|${tenant.slug}|${event.eventId}`;
    const metrics = metricsByKey.get(key);
    const state = nightState(event.startsAt, event.endsAt, now);
    return {
      key,
      name: event.name,
      tenantName: tenant.name,
      instanceName: instance.name,
      adminUrl: `${tenant.url}/admin/event/${event.slug}`,
      timeLabel: timeLabel(event.startsAt, event.endsAt, now),
      state,
      startsInLabel:
        state === "upcoming" ? formatIn(event.startsAt, now) : null,
      gone: event.goneAt !== null,
      unpublished: !event.isActive && event.inviteCondition !== "INVITATION",
      error:
        typeof metrics === "string"
          ? metrics
          : metrics
            ? null
            : "Sin métricas.",
      metrics:
        metrics && typeof metrics !== "string"
          ? summarize(metrics, event.startsAt, event.endsAt, now)
          : null,
    };
  });

  const live = nights.filter((night) => night.state === "live");
  return {
    generatedAtLabel: clockFormat.format(now),
    agenda: {
      lastRunLabel: lastRun ? formatAgo(lastRun.startedAt, now) : null,
      failures: (lastRun?.failures ?? []).map(({ name, error }) => ({
        name,
        error,
      })),
    },
    totals: {
      live: live.length,
      upcoming: nights.filter((night) => night.state === "upcoming").length,
      entered: live.reduce(
        (total, night) => total + (night.metrics?.entered ?? 0),
        0,
      ),
      pending: live.reduce(
        (total, night) => total + (night.metrics?.pending ?? 0),
        0,
      ),
      last10Minutes: live.reduce(
        (total, night) => total + (night.metrics?.last10Minutes ?? 0),
        0,
      ),
    },
    nights,
    instances: instanceRows.map((row) => ({
      id: row.id,
      name: row.name,
      modeLabel:
        row.mode === "multi"
          ? "Varias productoras"
          : row.mode === "single"
            ? "Una productora"
            : "Sin dato",
      versionLabel: versionLabel(row),
      lastSyncLabel: formatAgo(row.lastSyncedAt, now),
      error: row.lastError,
    })),
  };
}
