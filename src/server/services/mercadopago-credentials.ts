import {
  vercel,
  vercelApi,
  vercelDomainTarget,
} from "@/server/services/vercel-client";

export async function updateMercadoPagoCredentials({
  projectId,
  accessToken,
  refreshToken,
}: {
  projectId: string;
  accessToken: string;
  refreshToken: string;
}) {
  const fullProject = await vercelApi
    .get<{ name: string }>(`v1/projects/${projectId}`)
    .json();

  const envTarget = vercelDomainTarget;

  await vercel.projects.createProjectEnv({
    idOrName: projectId,
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
    projectId,
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
        project: projectId,
        name: fullProject.name,
        target: envTarget,
      },
    });
  }

  return { success: true as const, target: envTarget };
}
