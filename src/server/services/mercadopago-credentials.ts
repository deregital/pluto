import {
  vercel,
  vercelApi,
  vercelDomainTarget,
} from "@/server/services/vercel-client";
import { signedFetch } from "@/server/security/signed-request";
import { findPlanetaProjectByHostname } from "@/server/services/planeta-projects";

export async function storeMercadoPagoCredentials({
  instanceUrl,
  accessToken,
  refreshToken,
}: {
  instanceUrl: string;
  accessToken: string;
  refreshToken: string;
}) {
  const { project } = await findPlanetaProjectByHostname(instanceUrl);
  if (!project) {
    throw new Error(`No project found for instance URL: ${instanceUrl}`);
  }

  const credentialsUrl = new URL(
    "/api/credentials/mercadopago",
    instanceUrl,
  );
  const response = await signedFetch(credentialsUrl.toString(), {
    body: { accessToken, refreshToken },
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
    ],
  });

  const lastDeployment = await vercel.deployments.getDeployments({
    projectId: project.id,
    limit: 1,
    teamId: process.env.VERCEL_TEAM_ID,
    ...(envTarget === "production"
      ? { branch: "master" }
      : { target: "preview" }),
  });

  if (lastDeployment.deployments.length > 0) {
    await vercel.deployments.createDeployment({
      teamId: process.env.VERCEL_TEAM_ID,
      forceNew: "1",
      requestBody: {
        deploymentId: lastDeployment.deployments[0].uid,
        project: project.id,
        name: fullProject.name,
        ...(envTarget === "preview" ? {} : { target: envTarget }),
      },
    });
  }

  return {
    success: true as const,
    storage: "environment" as const,
    target: envTarget,
  };
}
