import { signedFetch } from "@/server/security/signed-request";
import { findPlanetaProjectByHostname } from "@/server/services/planeta-projects";
import {
  vercel,
  vercelApi,
  vercelDomainTarget,
} from "@/server/services/vercel-client";

export async function storeMercadoPagoCredentials({
  instanceUrl,
  accessToken,
  refreshToken,
  accessTokenExpiresAt,
}: {
  instanceUrl: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}) {
  const { project } = await findPlanetaProjectByHostname(instanceUrl);
  if (!project) {
    throw new Error(`No project found for instance URL: ${instanceUrl}`);
  }

  const credentialsUrl = new URL("/api/credentials/mercadopago", instanceUrl);
  const response = await signedFetch(credentialsUrl.toString(), {
    body: { accessToken, refreshToken, accessTokenExpiresAt },
  });

  if (response.ok) {
    return { success: true as const, storage: "control-database" as const };
  }

  const responseBody = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (response.status !== 409 || responseBody?.error !== "SINGLE_TENANT") {
    throw new Error(
      `Instance rejected Mercado Pago credentials (${response.status})`,
    );
  }

  const fullProject = await vercelApi
    .get<{ name: string }>(`v1/projects/${project.id}`)
    .json();

  const envTarget = vercelDomainTarget;

  await vercel.projects.createProjectEnv({
    idOrName: project.id,
    teamId: process.env.VERCEL_TEAM_ID,
    upsert: "true",
    requestBody: [
      {
        key: "MP_ACCESS_TOKEN",
        value: accessToken,
        type: "encrypted",
        target: [envTarget],
      },
      {
        key: "MP_REFRESH_TOKEN",
        value: refreshToken,
        type: "encrypted",
        target: [envTarget],
      },
      {
        key: "MP_ACCESS_TOKEN_EXPIRES_AT",
        value: accessTokenExpiresAt,
        type: "encrypted",
        target: [envTarget],
      },
    ],
  });

  await redeployLatest({
    projectId: project.id,
    projectName: fullProject.name,
  });

  return {
    success: true as const,
    storage: "environment" as const,
    target: envTarget,
  };
}

const MERCADO_PAGO_ENV_KEYS = [
  "MP_ACCESS_TOKEN",
  "MP_REFRESH_TOKEN",
  "MP_ACCESS_TOKEN_EXPIRES_AT",
];

/**
 * Desvincula Mercado Pago de una instancia single-tenant: borra las variables
 * que escribió `storeMercadoPagoCredentials` y redeploya. Las instancias
 * multi-tenant borran sus credenciales por su cuenta.
 */
export async function revokeMercadoPagoCredentials(instanceUrl: string) {
  const { project } = await findPlanetaProjectByHostname(instanceUrl);
  if (!project) return { success: false as const, error: "NOT_FOUND" as const };

  const fullProject = await vercelApi
    .get<{
      name: string;
      env: { id: string; key: string; target?: string | string[] }[];
    }>(`v1/projects/${project.id}`)
    .json();

  const envTarget = vercelDomainTarget;
  const envsToRemove = fullProject.env.filter((env) => {
    const targets = Array.isArray(env.target) ? env.target : [env.target];
    return (
      MERCADO_PAGO_ENV_KEYS.includes(env.key) && targets.includes(envTarget)
    );
  });

  for (const env of envsToRemove) {
    await vercel.projects.removeProjectEnv({
      idOrName: project.id,
      id: env.id,
      teamId: process.env.VERCEL_TEAM_ID,
    });
  }

  if (envsToRemove.length > 0) {
    await redeployLatest({
      projectId: project.id,
      projectName: fullProject.name,
    });
  }

  return {
    success: true as const,
    removed: envsToRemove.map((env) => env.key),
    redeployTriggered: envsToRemove.length > 0,
  };
}

async function redeployLatest({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const envTarget = vercelDomainTarget;
  const lastDeployment = await vercel.deployments.getDeployments({
    projectId,
    limit: 1,
    teamId: process.env.VERCEL_TEAM_ID,
    ...(envTarget === "production"
      ? { branch: "master" }
      : { target: "preview" }),
  });

  if (lastDeployment.deployments.length === 0) return;

  await vercel.deployments.createDeployment({
    teamId: process.env.VERCEL_TEAM_ID,
    forceNew: "1",
    requestBody: {
      deploymentId: lastDeployment.deployments[0].uid,
      project: projectId,
      name: projectName,
      ...(envTarget === "preview" ? {} : { target: envTarget }),
    },
  });
}
