import { z } from "zod";

import { signedFetch } from "@/server/security/signed-request";

/**
 * Cliente de los pedidos firmados que cada instalación de Planeta Nocturno
 * responde por la instancia entera (todas sus productoras). Ver
 * `src/app/api/pluto/agenda` y `src/app/api/pluto/night-metrics` en la app.
 */

const FETCH_TIMEOUT_MS = 20_000;
export const MAX_EVENTS_PER_METRICS_REQUEST = 50;

const versionSchema = z.object({
  commitSha: z.string().nullable(),
  commitRef: z.string().nullable(),
  environment: z.string().nullable(),
  deploymentId: z.string().nullable(),
});

const agendaResponseSchema = z.object({
  success: z.literal(true),
  instance: z.object({
    mode: z.enum(["single", "multi"]),
    name: z.string(),
    url: z.string(),
    version: versionSchema,
  }),
  tenants: z.array(
    z.object({
      slug: z.string().nullable(),
      name: z.string(),
      url: z.string(),
      events: z.array(
        z.object({
          id: z.uuid(),
          slug: z.string(),
          name: z.string(),
          startingDate: z.string(),
          endingDate: z.string(),
          locationName: z.string().nullable(),
          locationAddress: z.string().nullable(),
          coverImageUrl: z.string(),
          /** Publicado en la ticketera; las de invitación nunca lo están. */
          isActive: z.boolean(),
          inviteCondition: z.string(),
        }),
      ),
    }),
  ),
  failedTenants: z.array(
    z.object({ slug: z.string().nullable(), name: z.string() }),
  ),
});

export type InstanceAgenda = z.infer<typeof agendaResponseSchema>;

const countSchema = z.object({ valid: z.number(), entered: z.number() });

const nightMetricsSchema = z.object({
  event: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    startingDate: z.string().nullable(),
    endingDate: z.string().nullable(),
    inviteCondition: z.string(),
  }),
  asOf: z.string(),
  tickets: z.object({
    valid: z.number(),
    sold: z.number(),
    entered: z.number(),
    pending: z.number(),
    scannedOutsideWindow: z.number(),
  }),
  organizers: countSchema,
  unpaid: z.object({
    mercadoPago: z.number(),
    transfer: z.number(),
    checkout: z.number(),
    other: z.number(),
  }),
  raised: z.number(),
  firstEntryAt: z.string().nullable(),
  lastEntryAt: z.string().nullable(),
  byTicketType: z.array(
    countSchema.extend({
      id: z.string(),
      name: z.string(),
      category: z.string(),
    }),
  ),
  entriesPerMinute: z.array(
    z.object({ minute: z.string(), entries: z.number() }),
  ),
});

export type NightMetrics = z.infer<typeof nightMetricsSchema>;

const nightMetricsResponseSchema = z.object({
  success: z.literal(true),
  version: versionSchema,
  results: z.array(
    z.union([
      z.object({
        tenant: z.string().nullable(),
        eventId: z.string(),
        metrics: nightMetricsSchema,
      }),
      z.object({
        tenant: z.string().nullable(),
        eventId: z.string(),
        error: z.string(),
      }),
    ]),
  ),
});

export type NightMetricsResult = z.infer<
  typeof nightMetricsResponseSchema
>["results"][number];

export class InstanceApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "InstanceApiError";
  }
}

function describeStatus(status: number) {
  if (status === 404) {
    return "No tiene el pedido nuevo: la app de esta instalación no está actualizada.";
  }
  if (status === 401)
    return "Rechazó la firma de Pluto (revisar CREDENTIALS_SIGNING_SECRET).";
  return `Respondió ${status}.`;
}

async function post<Schema extends z.ZodType>(
  baseUrl: string,
  path: string,
  body: unknown,
  schema: Schema,
): Promise<z.infer<Schema>> {
  let response: Response;
  try {
    response = await signedFetch(new URL(path, baseUrl).toString(), {
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new InstanceApiError(
      timedOut
        ? `No respondió en ${FETCH_TIMEOUT_MS / 1000} segundos.`
        : "No se pudo conectar.",
      null,
    );
  }

  if (!response.ok) {
    throw new InstanceApiError(
      describeStatus(response.status),
      response.status,
    );
  }

  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new InstanceApiError(
      "La respuesta no tiene el formato esperado.",
      response.status,
    );
  }
  return parsed.data;
}

export function fetchInstanceAgenda(
  baseUrl: string,
  range: { from: Date; to: Date },
) {
  return post(
    baseUrl,
    "/api/pluto/agenda",
    {
      action: "pluto.agenda.v1",
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    agendaResponseSchema,
  );
}

export function fetchNightMetrics(
  baseUrl: string,
  events: { tenant: string | null; eventId: string }[],
) {
  return post(
    baseUrl,
    "/api/pluto/night-metrics",
    { action: "pluto.night-metrics.v1", events },
    nightMetricsResponseSchema,
  );
}
