import { vercel, vercelApi } from "@/server/services/vercel-client";

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

  await vercel.projects.createProjectEnv({
    idOrName: projectId,
    teamId: process.env.VERCEL_TEAM_ID,
    upsert: "true",
    requestBody: [
      {
        key: "MP_ACCESS_TOKEN",
        value: accessToken,
        type: "encrypted",
        target: ["production", "preview"],
      },
      {
        key: "MP_REFRESH_TOKEN",
        value: refreshToken,
        type: "encrypted",
        target: ["production", "preview"],
      },
    ],
  });

  const lastDeployment = await vercel.deployments.getDeployments({
    projectId,
    limit: 1,
    teamId: process.env.VERCEL_TEAM_ID,
    branch: "master",
  });

  if (lastDeployment.deployments.length > 0) {
    await vercel.deployments.createDeployment({
      teamId: process.env.VERCEL_TEAM_ID,
      forceNew: "1",
      requestBody: {
        deploymentId: lastDeployment.deployments[0].uid,
        project: projectId,
        name: fullProject.name,
        target: "production",
      },
    });
  }

  return { success: true as const };
}
