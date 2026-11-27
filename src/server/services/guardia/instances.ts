import { mapWithConcurrency } from "@/lib/utils";
import {
  getPlanetaProjects,
  getProjectProductionDomainNames,
} from "@/server/services/planeta-projects";

/** A cuántos dominios de un proyecto se prueba por vuelta, como mucho. */
const MAX_CANDIDATES = 3;

export type GuardiaInstance = {
  id: string;
  name: string;
  /** URLs base para preguntarle, en orden de preferencia. */
  candidates: string[];
};

function normalizeUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

/**
 * Los dominios por donde se le puede preguntar a una instalación. El panel
 * (`admin.`) y los comodines no sirven; primero el dominio raíz, que en las
 * multi-tenant responde por todas las productoras, y los de vercel.app al final.
 */
export function rankCandidateDomains(domains: string[]) {
  return [...new Set(domains.map((domain) => domain.toLowerCase()))]
    .filter(
      (domain) => !domain.startsWith("*.") && !domain.startsWith("admin."),
    )
    .sort((a, b) => {
      const aVercel = a.endsWith(".vercel.app") ? 1 : 0;
      const bVercel = b.endsWith(".vercel.app") ? 1 : 0;
      return (
        aVercel - bVercel ||
        a.split(".").length - b.split(".").length ||
        a.localeCompare(b)
      );
    })
    .slice(0, MAX_CANDIDATES)
    .map((domain) => `https://${domain}`);
}

/**
 * Las instalaciones que vigila la guardia: los proyectos de Vercel del repo de
 * la app. Con PLUTO_CALENDAR_INSTANCE_URLS (por ejemplo, en desarrollo) se
 * usan esas URLs en su lugar.
 */
export async function getGuardiaInstances(): Promise<GuardiaInstance[]> {
  const overrideUrls = process.env.PLUTO_CALENDAR_INSTANCE_URLS;
  if (overrideUrls) {
    return overrideUrls
      .split(",")
      .map(normalizeUrl)
      .filter(Boolean)
      .map((url) => ({ id: url, name: new URL(url).host, candidates: [url] }));
  }

  const { projects } = await getPlanetaProjects();
  return mapWithConcurrency(projects, 5, async (project) => ({
    id: project.id,
    name: project.name,
    candidates: rankCandidateDomains(
      await getProjectProductionDomainNames(project.id),
    ),
  }));
}
