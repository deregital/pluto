"use client";

import { AlertTriangle, ExternalLink, Moon, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { syncAgendaNow } from "@/app/actions/guardia";
import { Button } from "@/components/ui/button";
import type {
  NightState,
  TonightBoard,
  TonightNight,
} from "@/server/services/guardia/tonight";

const REFRESH_MS = 30_000;
const numberFormat = new Intl.NumberFormat("es-AR");
const n = (value: number) => numberFormat.format(value);
const count = (value: number, one: string, many: string) =>
  `${n(value)} ${value === 1 ? one : many}`;

const SECTIONS: { state: NightState; title: string }[] = [
  { state: "live", title: "En curso" },
  { state: "upcoming", title: "Más tarde" },
  { state: "ended", title: "Terminadas" },
];

export default function TonightDashboard({ board }: { board: TonightBoard }) {
  const router = useRouter();
  const [isSyncing, startSync] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  function readAgenda() {
    startSync(async () => {
      try {
        const result = await syncAgendaNow();
        setSyncMessage(
          result.instancesFailed > 0
            ? `Agenda leída: ${count(result.instancesOk, "instalación bien", "instalaciones bien")} y ${count(result.instancesFailed, "con problemas", "con problemas")}.`
            : `Agenda leída: ${count(result.instancesOk, "instalación", "instalaciones")}, ${count(result.eventsSeen, "evento", "eventos")}.`,
        );
      } catch {
        setSyncMessage("No se pudo leer la agenda. Probá de nuevo.");
      }
      router.refresh();
    });
  }

  const { totals } = board;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-24">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Moon className="size-4" aria-hidden />
            Guardia
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Noches de hoy
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Métricas de las {board.generatedAtLabel}; se actualizan solas cada
            30 segundos. Agenda leída {board.agenda.lastRunLabel ?? "nunca"}.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button variant="outline" onClick={readAgenda} disabled={isSyncing}>
            <RefreshCw className={isSyncing ? "animate-spin" : undefined} />
            {isSyncing ? "Leyendo la agenda…" : "Leer agenda ahora"}
          </Button>
          {syncMessage && (
            <p role="status" className="text-sm text-muted-foreground">
              {syncMessage}
            </p>
          )}
        </div>
      </header>

      <section
        aria-label="Totales de las noches en curso"
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <Stat
          label="En curso"
          value={n(totals.live)}
          hint={
            totals.upcoming > 0
              ? `${n(totals.upcoming)} más tarde`
              : "Ninguna más tarde"
          }
        />
        <Stat
          label="Adentro"
          value={n(totals.entered)}
          hint="En las noches en curso"
        />
        <Stat
          label="Faltan"
          value={n(totals.pending)}
          hint="En las noches en curso"
        />
        <Stat
          label="Últimos 10 minutos"
          value={n(totals.last10Minutes)}
          hint="En todas las puertas"
        />
      </section>

      {board.agenda.failures.length > 0 && (
        <Notice>
          La última lectura de la agenda no pudo leer{" "}
          {board.agenda.failures
            .map((failure) => `${failure.name} (${failure.error})`)
            .join("; ")}
        </Notice>
      )}

      {board.nights.length === 0 ? (
        <p className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          {board.agenda.lastRunLabel
            ? "No hay noches en la agenda para las próximas 18 horas."
            : "Todavía no se leyó la agenda. Tocá “Leer agenda ahora”."}
        </p>
      ) : (
        SECTIONS.map(({ state, title }) => {
          const nights = board.nights.filter((night) => night.state === state);
          if (nights.length === 0) return null;
          return (
            <section key={state} aria-labelledby={`noches-${state}`}>
              <h2
                id={`noches-${state}`}
                className="text-sm font-medium text-muted-foreground"
              >
                {title} · {nights.length}
              </h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {nights.map((night) => (
                  <NightCard key={night.key} night={night} />
                ))}
              </div>
            </section>
          );
        })
      )}

      {board.instances.length > 0 && (
        <section aria-labelledby="instalaciones">
          <h2
            id="instalaciones"
            className="text-sm font-medium text-muted-foreground"
          >
            Instalaciones
          </h2>
          <ul className="mt-3 divide-y rounded-md border bg-card">
            {board.instances.map((instance) => (
              <li key={instance.id} className="flex min-w-0 flex-col gap-1 p-3">
                <p className="truncate font-medium">{instance.name}</p>
                <p className="text-sm text-muted-foreground">
                  {instance.modeLabel} · versión {instance.versionLabel} · leída{" "}
                  {instance.lastSyncLabel}
                </p>
                {instance.error && (
                  <p className="flex items-start gap-1.5 text-sm text-destructive">
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden
                    />
                    <span>
                      <span className="sr-only">Error: </span>
                      {instance.error}
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="min-w-0 rounded-md border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function NightCard({ night }: { night: TonightNight }) {
  const { metrics } = night;

  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-md border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{night.name}</h3>
          <p className="text-sm text-muted-foreground">
            <span className="break-words">{night.tenantName}</span> ·{" "}
            <span className="whitespace-nowrap">{night.timeLabel}</span>
            {night.unpublished && " · no publicada"}
          </p>
        </div>
        <a
          href={night.adminUrl}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Abrir
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>

      {night.gone && (
        <Notice>
          Salió de la agenda: la borraron o le cambiaron la fecha.
        </Notice>
      )}
      {night.error && <Notice>{night.error}</Notice>}

      {metrics && (
        <>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-3xl font-semibold tabular-nums">
                {n(metrics.entered)}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  de {n(metrics.valid)}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {night.state === "upcoming"
                  ? `Empieza ${night.startsInLabel}`
                  : `${metrics.percent} % adentro`}
              </p>
            </div>
            {night.state !== "upcoming" && (
              <EntryBars
                bars={metrics.bars}
                bucketMinutes={metrics.bucketMinutes}
              />
            )}
          </div>

          {night.state !== "upcoming" && (
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Porcentaje adentro"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={metrics.percent}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, metrics.percent)}%` }}
              />
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {night.state !== "upcoming" && (
              <>
                <Detail label="Faltan" value={n(metrics.pending)} />
                <Detail
                  label="Últimos 10 min"
                  value={n(metrics.last10Minutes)}
                />
                <Detail label="Última entrada" value={metrics.lastEntryLabel} />
              </>
            )}
            {metrics.organizers.valid > 0 && (
              <Detail
                label="Organizadores"
                value={`${n(metrics.organizers.entered)} de ${n(metrics.organizers.valid)}`}
              />
            )}
            {metrics.unpaid > 0 && (
              <Detail label="Reservas sin pagar" value={n(metrics.unpaid)} />
            )}
            {metrics.scannedOutsideWindow > 0 && (
              <Detail
                label="Escaneos fuera de hora"
                value={n(metrics.scannedOutsideWindow)}
              />
            )}
          </dl>
        </>
      )}
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="truncate tabular-nums">{value}</dd>
    </div>
  );
}

const BARS_WIDTH = 160;
const BARS_HEIGHT = 40;
const BAR_GAP = 2;

/** Ingresos por tramo de la noche: una sola serie, sin leyenda. */
function EntryBars({
  bars,
  bucketMinutes,
}: {
  bars: { label: string; entries: number }[];
  bucketMinutes: number;
}) {
  const max = Math.max(1, ...bars.map((bar) => bar.entries));
  const barWidth = Math.max(
    1,
    (BARS_WIDTH - BAR_GAP * (bars.length - 1)) / bars.length,
  );

  return (
    <figure className="shrink-0 text-right">
      <svg
        width={BARS_WIDTH}
        height={BARS_HEIGHT}
        viewBox={`0 0 ${BARS_WIDTH} ${BARS_HEIGHT}`}
        role="img"
        aria-label={`Ingresos cada ${bucketMinutes} minutos`}
        className="text-primary"
      >
        <line
          x1={0}
          x2={BARS_WIDTH}
          y1={BARS_HEIGHT - 0.5}
          y2={BARS_HEIGHT - 0.5}
          className="stroke-border"
        />
        {bars.map((bar, index) => {
          const height =
            bar.entries === 0
              ? 0
              : Math.max(2, (bar.entries / max) * (BARS_HEIGHT - 2));
          return (
            <g key={index}>
              <rect
                x={index * (barWidth + BAR_GAP)}
                y={0}
                width={barWidth}
                height={BARS_HEIGHT}
                fill="transparent"
              >
                <title>{`${bar.label} · ${n(bar.entries)} ingresos`}</title>
              </rect>
              {height > 0 && (
                <rect
                  x={index * (barWidth + BAR_GAP)}
                  y={BARS_HEIGHT - height}
                  width={barWidth}
                  height={height}
                  rx={Math.min(2, barWidth / 2)}
                  fill="currentColor"
                  fillOpacity={0.75}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        Ingresos cada {bucketMinutes} min
      </figcaption>
    </figure>
  );
}
