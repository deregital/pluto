import { verifySignedRequest } from "@/server/security/signed-request";
import { findPlanetaProjectByHostname } from "@/server/services/planeta-projects";
import { vercel, vercelApi } from "@/server/services/vercel-client";
import { NextResponse } from "next/server";
import { z } from "zod";

const configureCredentialsSchema = z.object({
  projectUrl: z.url(),
  mpAccessToken: z.string().min(1),
  mpSecretKey: z.string().min(1),
  redeploy: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  console.log("[api/credentials] Incoming request");

  const signedRequest = await verifySignedRequest(request, {
    logPrefix: "[api/credentials]",
  });
  if (!signedRequest.ok) {
    return signedRequest.response;
  }

  let body: z.infer<typeof configureCredentialsSchema>;
  try {
    const rawBody = signedRequest.rawBody;
    console.log("[api/credentials] Raw body received", {
      bytes: rawBody.length,
    });

    console.log("[api/credentials] HMAC signature validated");

    const payload = JSON.parse(rawBody);
    body = configureCredentialsSchema.parse(payload);

    console.log("[api/credentials] Payload schema validated", {
      projectUrl: body.projectUrl,
      redeploy: body.redeploy,
      mpAccessTokenLength: body.mpAccessToken.length,
      mpSecretKeyLength: body.mpSecretKey.length,
    });
  } catch {
    console.warn("[api/credentials] Invalid request body");
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "Body inválido." },
      { status: 400 },
    );
  }

  let targetHostname = "";

  try {
    const lookup = await findPlanetaProjectByHostname(body.projectUrl);
    const matchedProject = lookup.project;
    targetHostname = lookup.targetHostname;

    console.log("[api/credentials] Looking up Vercel project by hostname", {
      targetHostname,
    });

    if (!matchedProject) {
      console.warn("[api/credentials] Project not found for hostname", {
        targetHostname,
      });
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: `No se encontró proyecto en Vercel para el dominio ${targetHostname}.`,
        },
        { status: 404 },
      );
    }

    const fullProject = await vercelApi
      .get<{
        env: { id: string; key: string }[];
      }>(`v1/projects/${matchedProject.id}`)
      .json();
    console.log("[api/credentials] Project found", {
      projectId: matchedProject.id,
      projectName: matchedProject.name,
    });

    const upsertEnv = async (
      key: "MP_ACCESS_TOKEN" | "MP_SECRET_KEY",
      value: string,
    ) => {
      const existingEnv = fullProject.env.find((env) => env.key === key);
      if (existingEnv) {
        console.log("[api/credentials] Updating existing env", {
          key,
          projectId: matchedProject.id,
          valueLength: value.length,
        });
        await vercel.projects.editProjectEnv({
          idOrName: matchedProject.id,
          id: existingEnv.id,
          teamId: process.env.VERCEL_TEAM_ID,
          requestBody: {
            key,
            value,
            type: "encrypted",
            target: ["production", "preview"],
          },
        });
        return;
      }

      console.log("[api/credentials] Creating missing env", {
        key,
        projectId: matchedProject.id,
        valueLength: value.length,
      });
      await vercel.projects.createProjectEnv({
        idOrName: matchedProject.id,
        teamId: process.env.VERCEL_TEAM_ID,
        requestBody: {
          key,
          value,
          type: "encrypted",
          target: ["production", "preview"],
        },
      });
    };

    await upsertEnv("MP_ACCESS_TOKEN", body.mpAccessToken);
    await upsertEnv("MP_SECRET_KEY", body.mpSecretKey);
    console.log("[api/credentials] Mercado Pago envs upserted");

    if (body.redeploy) {
      console.log("[api/credentials] Redeploy requested");
      const lastDeployment = await vercel.deployments.getDeployments({
        projectId: matchedProject.id,
        limit: 1,
        teamId: process.env.VERCEL_TEAM_ID,
        branch: "master",
      });

      if (lastDeployment.deployments.length > 0) {
        console.log("[api/credentials] Triggering redeploy", {
          previousDeploymentId: lastDeployment.deployments[0].uid,
          projectId: matchedProject.id,
        });
        await vercel.deployments.createDeployment({
          teamId: process.env.VERCEL_TEAM_ID,
          forceNew: "1",
          requestBody: {
            deploymentId: lastDeployment.deployments[0].uid,
            project: matchedProject.id,
            name: matchedProject.name,
            target: "production",
          },
        });
      } else {
        console.warn(
          "[api/credentials] No previous deployment found, redeploy skipped",
          {
            projectId: matchedProject.id,
          },
        );
      }
    }

    console.log("[api/credentials] Request completed successfully", {
      projectId: matchedProject.id,
      projectName: matchedProject.name,
      domain: targetHostname,
      redeployTriggered: body.redeploy,
    });
    return NextResponse.json({
      success: true,
      projectId: matchedProject.id,
      projectName: matchedProject.name,
      domain: targetHostname,
      redeployTriggered: body.redeploy,
    });
  } catch (error) {
    console.error(
      "[api/credentials] Error configuring Mercado Pago credentials",
      {
        targetHostname,
        error,
      },
    );
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }
}
