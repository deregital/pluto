import { verifySignedRequest } from "@/server/security/signed-request";
import { findPlanetaProjectByHostname } from "@/server/services/planeta-projects";
import { vercel } from "@/server/services/vercel-client";
import { NextResponse } from "next/server";
import { z } from "zod";

const redeployStatusSchema = z.object({
  projectUrl: z.url(),
});

const deploymentDataSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  createdAt: z.number().optional(),
  readyState: z.string().optional(),
  state: z.string().optional(),
  url: z.url().optional(),
});

const redeployStatusResponseSchema = z.union([
  z.object({
    success: z.literal(true),
    projectId: z.string(),
    projectName: z.string(),
    domain: z.string(),
    hasDeployments: z.literal(false),
    isRedeploying: z.literal(false),
    redeploySuccess: z.literal(false),
    status: z.literal("NO_DEPLOYMENTS"),
  }),
  z.object({
    success: z.literal(true),
    projectId: z.string(),
    projectName: z.string(),
    domain: z.string(),
    hasDeployments: z.literal(true),
    isRedeploying: z.boolean(),
    redeploySuccess: z.boolean(),
    status: z.enum(["IN_PROGRESS", "SUCCESS", "FAILED", "UNKNOWN"]),
    vercelState: z.string(),
    deployment: deploymentDataSchema,
  }),
]);

function getDeploymentState(lastDeployment: Record<string, unknown>) {
  const readyStateRaw =
    typeof lastDeployment.readyState === "string"
      ? lastDeployment.readyState.toUpperCase()
      : undefined;
  const stateRaw =
    typeof lastDeployment.state === "string"
      ? lastDeployment.state.toUpperCase()
      : undefined;

  const state = readyStateRaw ?? stateRaw ?? "UNKNOWN";

  if (["BUILDING", "QUEUED", "INITIALIZING"].includes(state)) {
    return {
      isRedeploying: true,
      success: false,
      status: "IN_PROGRESS" as const,
      state,
    };
  }

  if (["READY", "SUCCEEDED"].includes(state)) {
    return {
      isRedeploying: false,
      success: true,
      status: "SUCCESS" as const,
      state,
    };
  }

  if (["ERROR", "CANCELED", "FAILED"].includes(state)) {
    return {
      isRedeploying: false,
      success: false,
      status: "FAILED" as const,
      state,
    };
  }

  return {
    isRedeploying: false,
    success: false,
    status: "UNKNOWN" as const,
    state,
  };
}

export async function POST(request: Request) {
  console.log("[api/credentials/status] Incoming request");

  const signedRequest = await verifySignedRequest(request, {
    logPrefix: "[api/credentials/status]",
  });
  if (!signedRequest.ok) {
    return signedRequest.response;
  }

  let body: z.infer<typeof redeployStatusSchema>;
  try {
    const rawBody = signedRequest.rawBody;
    const payload = JSON.parse(rawBody);
    body = redeployStatusSchema.parse(payload);
  } catch {
    console.warn("[api/credentials/status] Invalid request body");
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

    if (!matchedProject) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: `No se encontró proyecto en Vercel para el dominio ${targetHostname}.`,
        },
        { status: 404 },
      );
    }

    const lastDeployments = await vercel.deployments.getDeployments({
      projectId: matchedProject.id,
      limit: 1,
      teamId: process.env.VERCEL_TEAM_ID,
      branch: "master",
    });

    const lastDeployment = lastDeployments.deployments[0] as
      | Record<string, unknown>
      | undefined;

    if (!lastDeployment) {
      const response = redeployStatusResponseSchema.parse({
        success: true,
        projectId: matchedProject.id,
        projectName: matchedProject.name,
        domain: targetHostname,
        hasDeployments: false,
        isRedeploying: false,
        redeploySuccess: false,
        status: "NO_DEPLOYMENTS",
      });

      return NextResponse.json(response, { status: 200 });
    }

    const deploymentState = getDeploymentState(lastDeployment);

    const response = redeployStatusResponseSchema.parse({
      success: true,
      projectId: matchedProject.id,
      projectName: matchedProject.name,
      domain: targetHostname,
      hasDeployments: true,
      isRedeploying: deploymentState.isRedeploying,
      redeploySuccess: deploymentState.success,
      status: deploymentState.status,
      vercelState: deploymentState.state,
      deployment: {
        id:
          typeof lastDeployment.uid === "string"
            ? lastDeployment.uid
            : undefined,
        name:
          typeof lastDeployment.name === "string"
            ? lastDeployment.name
            : undefined,
        createdAt:
          typeof lastDeployment.createdAt === "number"
            ? lastDeployment.createdAt
            : undefined,
        readyState:
          typeof lastDeployment.readyState === "string"
            ? lastDeployment.readyState
            : undefined,
        state:
          typeof lastDeployment.state === "string"
            ? lastDeployment.state
            : undefined,
        url:
          typeof lastDeployment.url === "string"
            ? `https://${lastDeployment.url}`
            : undefined,
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[api/credentials/redeploy-status] Unexpected error", {
      targetHostname,
      error,
    });
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }
}
