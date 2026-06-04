import { GetProjectsResponseBody } from "@vercel/sdk/models/getprojectsop.js";
import { cache } from "react";

import { GITHUB_REPO_URL } from "@/server/config";
import { mapWithConcurrency } from "@/lib/utils";
import {
  vercel,
  vercelApi,
  vercelDomainTarget,
} from "@/server/services/vercel-client";

const VERCEL_DOMAIN_FETCH_CONCURRENCY = 5;

export function normalizeHostname(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  }
}

type VercelProject = {
  id: string;
  name: string;
  env?: { id?: string; key: string }[];
  updatedAt?: Date | string | number | null;
} & Record<string, unknown>;

type PlanetaProject = VercelProject & {
  domain: string;
};

const getProjectDomains = cache(async (projectId: string) => {
  if (vercelDomainTarget === "production") {
    const response = await vercel.projects.getProjectDomains({
      idOrName: projectId,
      teamId: process.env.VERCEL_TEAM_ID,
      production: "true",
      verified: "true",
    });

    return response.domains ?? [];
  }

  const { domains } = await vercelApi
    .get<{ domains?: { name?: string }[] }>(
      `v9/projects/${projectId}/domains`,
      {
        searchParams: { target: "preview", verified: "true" },
      },
    )
    .json();

  return domains ?? [];
});

async function getProjectProductionDomain(projectId: string) {
  const domains = await getProjectDomains(projectId);

  return domains[0]?.name ?? "";
}

async function getProjectDomainNames(projectId: string) {
  const domains = await getProjectDomains(projectId);

  return domains
    .map((domain) => domain.name?.toLowerCase())
    .filter(Boolean) as string[];
}

async function getPlanetaProjectItems() {
  try {
    const projectsResponse = await vercel.projects.getProjects(
      {
        teamId: process.env.VERCEL_TEAM_ID,
        repoUrl: GITHUB_REPO_URL,
      },
      {
        next: { tags: ["projects"] },
      },
    );

    return {
      projectItems: Array.isArray(projectsResponse)
        ? (projectsResponse as VercelProject[])
        : ((projectsResponse as { projects?: VercelProject[] }).projects ?? []),
      pagination: Array.isArray(projectsResponse)
        ? undefined
        : projectsResponse.pagination,
    };
  } catch (error) {
    console.error("Error getting projects from Vercel SDK", error);
  }

  const projectsResponse = await vercelApi
    .get<GetProjectsResponseBody>("v1/projects", {
      searchParams: {
        teamId: process.env.VERCEL_TEAM_ID ?? "",
        repoUrl: GITHUB_REPO_URL,
      },
    })
    .json();

  return {
    projectItems: Array.isArray(projectsResponse)
      ? (projectsResponse as VercelProject[])
      : ((projectsResponse as { projects?: VercelProject[] }).projects ?? []),
    pagination: Array.isArray(projectsResponse)
      ? undefined
      : projectsResponse.pagination,
  };
}

export async function getPlanetaProjects() {
  try {
    const { projectItems, pagination } = await getPlanetaProjectItems();
    const projects = await mapWithConcurrency(
      projectItems,
      VERCEL_DOMAIN_FETCH_CONCURRENCY,
      async (project) => {
        const domain = await getProjectProductionDomain(project.id);

        return {
          ...project,
          domain: domain ? `https://${domain}` : "",
        };
      },
    );

    return {
      projects: projects as PlanetaProject[],
      pagination,
    };
  } catch (error) {
    console.error("Error getting Planeta Nocturno projects", error);
    return {
      projects: [],
      pagination: [],
    };
  }
}

export async function findPlanetaProjectByHostname(hostname: string) {
  const targetHostname = normalizeHostname(hostname);
  const { projectItems } = await getPlanetaProjectItems();

  const matchedProject = (
    await mapWithConcurrency(
      projectItems,
      VERCEL_DOMAIN_FETCH_CONCURRENCY,
      async (project) => {
        const domainNames = await getProjectDomainNames(project.id);
        return domainNames.includes(targetHostname) ? project : null;
      },
    )
  ).find((project) => project !== null);

  return matchedProject
    ? {
        project: matchedProject,
        targetHostname,
      }
    : {
        project: null,
        targetHostname,
      };
}
