import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Base propia de Pluto para la guardia. Guarda lo que Pluto lee de cada
 * instalación (la agenda) y, más adelante, las fotos de cada vuelta, las
 * alertas y las notas por productora. Nunca datos personales de compradores:
 * las instalaciones sólo le devuelven totales.
 */

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

/** Un proyecto de Vercel que corre Planeta Nocturno. */
export const instances = pgTable("instances", {
  /** Id del proyecto de Vercel (o la URL, con PLUTO_CALENDAR_INSTANCE_URLS). */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Por dónde se le pregunta: el dominio raíz en las multi-tenant. */
  baseUrl: text("base_url").notNull(),
  mode: text("mode", { enum: ["single", "multi"] }),
  commitSha: text("commit_sha"),
  commitRef: text("commit_ref"),
  deploymentId: text("deployment_id"),
  lastSyncedAt: timestamptz("last_synced_at"),
  lastError: text("last_error"),
  lastErrorAt: timestamptz("last_error_at"),
  createdAt: timestamptz("created_at").defaultNow().notNull(),
  updatedAt: timestamptz("updated_at").defaultNow().notNull(),
});

/** Una productora de una instalación; `slug` es null en las de una sola. */
export const tenants = pgTable(
  "tenants",
  {
    id: serial("id").primaryKey(),
    instanceId: text("instance_id")
      .notNull()
      .references(() => instances.id, { onDelete: "cascade" }),
    slug: text("slug"),
    name: text("name").notNull(),
    url: text("url").notNull(),
    firstSeenAt: timestamptz("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamptz("last_seen_at").defaultNow().notNull(),
  },
  (table) => [
    unique("tenants_instance_slug_unique")
      .on(table.instanceId, table.slug)
      .nullsNotDistinct(),
  ],
);

/** Un evento que Pluto vio en la agenda de una productora. */
export const agendaEvents = pgTable(
  "agenda_events",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Id del evento en la base de la productora. */
    eventId: uuid("event_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    startsAt: timestamptz("starts_at").notNull(),
    endsAt: timestamptz("ends_at").notNull(),
    locationName: text("location_name"),
    locationAddress: text("location_address"),
    coverImageUrl: text("cover_image_url"),
    /** Publicado en la ticketera; las de invitación nunca lo están. */
    isActive: boolean("is_active").notNull(),
    inviteCondition: text("invite_condition").notNull(),
    firstSeenAt: timestamptz("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamptz("last_seen_at").defaultNow().notNull(),
    /**
     * Cuándo dejó de aparecer en la ventana de la agenda: lo borraron o le
     * cambiaron la fecha. Vuelve a null si reaparece.
     */
    goneAt: timestamptz("gone_at"),
  },
  (table) => [
    unique("agenda_events_tenant_event_unique").on(
      table.tenantId,
      table.eventId,
    ),
    index("agenda_events_starts_at_idx").on(table.startsAt),
  ],
);

export type SyncFailure = { instanceId: string; name: string; error: string };

/** Cada lectura de la agenda, para ver si corre y qué falló. */
export const syncRuns = pgTable(
  "sync_runs",
  {
    id: serial("id").primaryKey(),
    kind: text("kind", { enum: ["agenda"] }).notNull(),
    startedAt: timestamptz("started_at").notNull(),
    finishedAt: timestamptz("finished_at"),
    instancesOk: integer("instances_ok").default(0).notNull(),
    instancesFailed: integer("instances_failed").default(0).notNull(),
    eventsSeen: integer("events_seen").default(0).notNull(),
    failures: jsonb("failures").$type<SyncFailure[]>().default([]).notNull(),
  },
  (table) => [index("sync_runs_started_at_idx").on(table.startedAt)],
);
