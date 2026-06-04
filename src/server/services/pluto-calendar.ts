import { z } from "zod";

import { signPayload } from "@/server/security/signed-request";
import { getPlanetaProjects } from "@/server/services/planeta-projects";
import { getVercelOidcToken } from "@vercel/oidc";
const DEFAULT_FETCH_TIMEOUT_MS = 120_000;

function getFetchTimeoutMs() {
  const configuredTimeout = Number(process.env.PLUTO_CALENDAR_FETCH_TIMEOUT_MS);
  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_FETCH_TIMEOUT_MS;
}

const calendarEventResponseSchema = z.object({
  success: z.literal(true),
  instance: z.object({
    name: z.string(),
    url: z.string(),
  }),
  events: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      startingDate: z.string(),
      endingDate: z.string(),
      locationName: z.string(),
      locationAddress: z.string(),
      coverImageUrl: z.string(),
      stats: z.object({
        ticketsSold: z.number(),
        ticketsIssued: z.number(),
        ticketsScanned: z.number(),
        attendanceRate: z.number(),
        totalRaised: z.number(),
      }),
    }),
  ),
});

export type PlutoCalendarEvent = {
  instanceName: string;
  instanceUrl: string;
  eventId: string;
  eventUrl: string;
  name: string;
  startingDate: string;
  endingDate: string;
  locationName: string;
  locationAddress: string;
  coverImageUrl: string;
  stats: {
    ticketsSold: number;
    ticketsIssued: number;
    ticketsScanned: number;
    attendanceRate: number;
    totalRaised: number;
  };
};

export type PlutoCalendarFailure = {
  instanceName: string;
  instanceUrl: string;
  message: string;
};

function getProjectLabel(project: { name: string; domain?: string }) {
  return project.domain || project.name;
}

function normalizeInstanceUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

async function getCalendarInstances() {
  const overrideUrls = process.env.PLUTO_CALENDAR_INSTANCE_URLS;
  if (overrideUrls) {
    return overrideUrls
      .split(",")
      .map(normalizeInstanceUrl)
      .filter(Boolean)
      .map((url) => ({
        name: url,
        domain: url,
      }));
  }

  const { projects } = await getPlanetaProjects();
  return projects.filter((project) => project.domain);
}

async function fetchInstanceCalendarEvents({
  instanceName,
  instanceUrl,
  from,
  to,
}: {
  instanceName: string;
  instanceUrl: string;
  from: Date;
  to: Date;
}) {
  const rawBody = JSON.stringify({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const timestamp = Date.now().toString();
  const signature = signPayload(timestamp, rawBody);

  if (!signature) {
    throw new Error("CREDENTIALS_SIGNING_SECRET is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getFetchTimeoutMs());

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-timestamp": timestamp,
      "x-signature": `sha256=${signature}`,
    };

    const oidcToken = await getVercelOidcToken();
    if (oidcToken) {
      headers["x-vercel-trusted-oidc-idp-token"] = oidcToken;
    }

    const protectionBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (protectionBypassSecret) {
      headers["x-vercel-protection-bypass"] = protectionBypassSecret;
    }

    const response = await fetch(`${instanceUrl}/api/pluto/calendar-events`, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers,
      body: rawBody,
    });

    if (!response.ok) {
      const responsePreview = (await response.text()).slice(0, 120);
      console.error("[pluto-calendar] Instance fetch failed", {
        instanceUrl,
        status: response.status,
        hasOidcToken: Boolean(oidcToken),
        hasBypassSecret: Boolean(protectionBypassSecret),
        responsePreview,
      });
      throw new Error(`HTTP ${response.status}`);
    }

    const data = calendarEventResponseSchema.parse(await response.json());

    return data.events.map((event) => ({
      instanceName: data.instance.name || instanceName,
      instanceUrl: data.instance.url || instanceUrl,
      eventId: event.id,
      eventUrl: `${data.instance.url || instanceUrl}/event/${event.slug}`,
      name: event.name,
      startingDate: event.startingDate,
      endingDate: event.endingDate,
      locationName: event.locationName,
      locationAddress: event.locationAddress,
      coverImageUrl: event.coverImageUrl,
      stats: event.stats,
    })) satisfies PlutoCalendarEvent[];
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPlutoCalendarEvents({
  from,
  to,
}: {
  from: Date;
  to: Date;
}) {
  const instances = await getCalendarInstances();

  const settled = await Promise.allSettled(
    instances.map(async (instance) => ({
      instance,
      events: await fetchInstanceCalendarEvents({
        instanceName: getProjectLabel(instance),
        instanceUrl: instance.domain,
        from,
        to,
      }),
    })),
  );

  const events: PlutoCalendarEvent[] = [];
  const failures: PlutoCalendarFailure[] = [];

  settled.forEach((result, index) => {
    const instance = instances[index];

    if (result.status === "fulfilled") {
      events.push(...result.value.events);
      return;
    }

    failures.push({
      instanceName: getProjectLabel(instance),
      instanceUrl: instance.domain,
      message:
        result.reason instanceof Error
          ? result.reason.message
          : "No pudimos cargar esta instancia",
    });
  });

  return {
    events: events.sort(
      (a, b) =>
        new Date(a.startingDate).getTime() - new Date(b.startingDate).getTime(),
    ),
    failures,
  };
}
