"use client";

import {
  eachDayOfInterval,
  endOfDay,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type CalendarMode } from "@/lib/calendar-ranges";
import {
  type PlutoCalendarEvent,
  type PlutoCalendarFailure,
} from "@/server/services/pluto-calendar";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-AR");

function eventOverlapsDay(event: PlutoCalendarEvent, day: Date) {
  const eventStart = parseISO(event.startingDate);
  const eventEnd = parseISO(event.endingDate);

  return eventStart <= endOfDay(day) && eventEnd >= startOfDay(day);
}

function getEventState(event: PlutoCalendarEvent) {
  const now = new Date();
  const start = parseISO(event.startingDate);
  const end = parseISO(event.endingDate);

  if (end < now) return "Finalizado";
  if (start <= now && end >= now) return "En curso";
  return "Próximo";
}

function buildCalendarHref({
  mode,
  date,
}: {
  mode: CalendarMode;
  date: string;
}) {
  return `/calendar?mode=${mode}&date=${date}`;
}

function EventPill({ event }: { event: PlutoCalendarEvent }) {
  const state = getEventState(event);
  const isFinished = state === "Finalizado";

  return (
    <a
      href={event.eventUrl}
      target="_blank"
      rel="noreferrer"
      className="block rounded-md border border-border bg-background p-2 text-xs transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug text-foreground">{event.name}</p>
        <span className="shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
          {state}
        </span>
      </div>
      <p className="mt-1 text-muted-foreground">{event.instanceName}</p>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          {format(parseISO(event.startingDate), "HH:mm")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Ticket className="size-3" />
          {numberFormatter.format(event.stats.ticketsSold)}
        </span>
      </div>
      <p className="mt-1 truncate text-muted-foreground">
        {currencyFormatter.format(event.stats.totalRaised)}
      </p>
      {isFinished && (
        <p className="mt-1 text-muted-foreground">
          {numberFormatter.format(event.stats.ticketsScanned)} escaneados ·{" "}
          {event.stats.attendanceRate.toFixed(1)}%
        </p>
      )}
    </a>
  );
}

export default function CalendarDashboard({
  events,
  failures,
  mode,
  range,
}: {
  events: PlutoCalendarEvent[];
  failures: PlutoCalendarFailure[];
  mode: CalendarMode;
  range: {
    from: string;
    to: string;
    date: string;
    previousDate: string;
    nextDate: string;
    label: string;
  };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedInstance, setSelectedInstance] = useState("all");

  const rangeStart = useMemo(() => parseISO(range.from), [range.from]);
  const rangeEnd = useMemo(() => parseISO(range.to), [range.to]);

  const instances = useMemo(
    () =>
      Array.from(new Set(events.map((event) => event.instanceName))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [events],
  );

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return events.filter((event) => {
      const matchesInstance =
        selectedInstance === "all" || event.instanceName === selectedInstance;
      if (!matchesInstance) return false;

      if (!normalizedQuery) return true;

      const searchable = `${event.name} ${event.instanceName} ${event.locationName}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      return searchable.includes(normalizedQuery);
    });
  }, [events, query, selectedInstance]);

  const days = useMemo(() => {
    const start =
      mode === "month"
        ? startOfWeek(rangeStart, { weekStartsOn: 1 })
        : rangeStart;
    const end =
      mode === "month" ? endOfWeek(rangeEnd, { weekStartsOn: 1 }) : rangeEnd;

    return eachDayOfInterval({ start, end });
  }, [mode, rangeEnd, rangeStart]);

  const totals = useMemo(
    () =>
      filteredEvents.reduce(
        (acc, event) => {
          acc.events++;
          acc.sold += event.stats.ticketsSold;
          acc.raised += event.stats.totalRaised;
          acc.scanned += event.stats.ticketsScanned;
          return acc;
        },
        { events: 0, sold: 0, raised: 0, scanned: 0 },
      ),
    [filteredEvents],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            <span>Planeta Nocturno</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Calendario de eventos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Eventos próximos y métricas consolidadas por cliente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant={mode === "month" ? "default" : "outline"}>
            <Link href={buildCalendarHref({ mode: "month", date: range.date })}>
              Mes
            </Link>
          </Button>
          <Button
            asChild
            variant={mode === "weekend" ? "default" : "outline"}
          >
            <Link
              href={buildCalendarHref({ mode: "weekend", date: range.date })}
            >
              Fin de semana
            </Link>
          </Button>
          <Button variant="outline" onClick={() => router.refresh()}>
            <RefreshCw />
            Actualizar
          </Button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border bg-card p-4">
          <p className="text-sm text-muted-foreground">Eventos</p>
          <p className="mt-1 text-2xl font-semibold">{totals.events}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-sm text-muted-foreground">Tickets vendidos</p>
          <p className="mt-1 text-2xl font-semibold">
            {numberFormatter.format(totals.sold)}
          </p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-sm text-muted-foreground">Recaudación</p>
          <p className="mt-1 text-2xl font-semibold">
            {currencyFormatter.format(totals.raised)}
          </p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-sm text-muted-foreground">Escaneados</p>
          <p className="mt-1 text-2xl font-semibold">
            {numberFormatter.format(totals.scanned)}
          </p>
        </div>
      </section>

      {failures.length > 0 && (
        <section className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          No pudimos cargar {failures.length} instancia
          {failures.length === 1 ? "" : "s"}:{" "}
          {failures.map((failure) => failure.instanceName).join(", ")}.
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-md border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon">
            <Link
              aria-label="Periodo anterior"
              href={buildCalendarHref({
                mode,
                date: range.previousDate,
              })}
            >
              <ChevronLeft />
            </Link>
          </Button>
          <div className="min-w-48 text-center">
            <p className="text-sm text-muted-foreground">Periodo</p>
            <p className="font-medium capitalize">{range.label}</p>
          </div>
          <Button asChild variant="outline" size="icon">
            <Link
              aria-label="Periodo siguiente"
              href={buildCalendarHref({
                mode,
                date: range.nextDate,
              })}
            >
              <ChevronRight />
            </Link>
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-64">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar evento, cliente o lugar"
              className="pr-9"
            />
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <select
            value={selectedInstance}
            aria-label="Seleccionar cliente"
            onChange={(event) => setSelectedInstance(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">Todos los clientes</option>
            {instances.map((instance) => (
              <option key={instance} value={instance}>
                {instance}
              </option>
            ))}
          </select>
        </div>
      </section>

      {filteredEvents.length === 0 ? (
        <section className="rounded-md border border-dashed p-10 text-center">
          <p className="text-lg font-medium">No hay eventos para mostrar</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Probá con otro periodo, cliente o búsqueda.
          </p>
        </section>
      ) : (
        <section
          className={
            mode === "month"
              ? "grid gap-px overflow-hidden rounded-md border bg-border md:grid-cols-7"
              : "grid gap-px overflow-hidden rounded-md border bg-border md:grid-cols-3"
          }
        >
          {(() => {
            const dayEventsMap = new Map<string, PlutoCalendarEvent[]>();
            const visibleStart = startOfDay(days[0]);
            const visibleEnd = endOfDay(days[days.length - 1]);

            days.forEach((day) => {
              dayEventsMap.set(format(day, "yyyy-MM-dd"), []);
            });

            filteredEvents.forEach((event) => {
              const eventStart = parseISO(event.startingDate);
              const eventEnd = parseISO(event.endingDate);
              const overlapStart =
                eventStart > visibleStart ? eventStart : visibleStart;
              const overlapEnd = eventEnd < visibleEnd ? eventEnd : visibleEnd;

              if (overlapStart > overlapEnd) {
                return;
              }

              eachDayOfInterval({
                start: startOfDay(overlapStart),
                end: startOfDay(overlapEnd),
              }).forEach((overlapDay) => {
                const dayKey = format(overlapDay, "yyyy-MM-dd");
                const dayEvents = dayEventsMap.get(dayKey);

                if (dayEvents) {
                  dayEvents.push(event);
                }
              });
            });

            return days.map((day) => {
              const dayEvents =
                dayEventsMap.get(format(day, "yyyy-MM-dd")) ?? [];
              const isMuted = mode === "month" && !isSameMonth(day, rangeStart);

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-40 bg-background p-3 ${isMuted ? "text-muted-foreground" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">
                        {format(day, "EEE", { locale: es })}
                      </p>
                      <p className="text-lg font-semibold">
                        {format(day, "d", { locale: es })}
                      </p>
                    </div>
                    <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                      {dayEvents.length}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    {dayEvents.map((event) => (
                      <EventPill
                        key={`${event.instanceUrl}-${event.eventId}`}
                        event={event}
                      />
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </section>
      )}

      <section className="rounded-md border bg-card p-4">
        <h2 className="text-lg font-semibold">Eventos del periodo</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Evento</th>
                <th className="py-2 pr-4 font-medium">Cliente</th>
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 pr-4 font-medium">Lugar</th>
                <th className="py-2 pr-4 font-medium">Vendidos</th>
                <th className="py-2 pr-4 font-medium">Escaneados</th>
                <th className="py-2 font-medium">Recaudación</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr
                  key={`${event.instanceUrl}-${event.eventId}-row`}
                  className="border-b last:border-0"
                >
                  <td className="py-3 pr-4 font-medium">
                    <a
                      href={event.eventUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {event.name}
                    </a>
                  </td>
                  <td className="py-3 pr-4">{event.instanceName}</td>
                  <td className="py-3 pr-4">
                    {format(parseISO(event.startingDate), "dd/MM HH:mm")}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {event.locationName}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {numberFormatter.format(event.stats.ticketsSold)}
                  </td>
                  <td className="py-3 pr-4">
                    {numberFormatter.format(event.stats.ticketsScanned)} ·{" "}
                    {event.stats.attendanceRate.toFixed(1)}%
                  </td>
                  <td className="py-3">
                    {currencyFormatter.format(event.stats.totalRaised)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
