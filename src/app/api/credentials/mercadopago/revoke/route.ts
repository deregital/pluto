import { verifySignedRequest } from "@/server/security/signed-request";
import { revokeMercadoPagoCredentials } from "@/server/services/mercadopago-credentials";
import { NextResponse } from "next/server";
import { z } from "zod";

const revokeCredentialsSchema = z.object({
  projectUrl: z.url(),
});

export async function POST(request: Request) {
  const signedRequest = await verifySignedRequest(request, {
    logPrefix: "[api/credentials/mercadopago/revoke]",
  });
  if (!signedRequest.ok) {
    return signedRequest.response;
  }

  let body: z.infer<typeof revokeCredentialsSchema>;
  try {
    body = revokeCredentialsSchema.parse(JSON.parse(signedRequest.rawBody));
  } catch {
    return NextResponse.json(
      { error: "BAD_REQUEST", message: "Body inválido." },
      { status: 400 },
    );
  }

  try {
    const result = await revokeMercadoPagoCredentials(body.projectUrl);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: `No se encontró proyecto en Vercel para ${body.projectUrl}.`,
        },
        { status: 404 },
      );
    }

    console.log("[api/credentials/mercadopago/revoke] Credentials revoked", {
      projectUrl: body.projectUrl,
      removed: result.removed,
      redeployTriggered: result.redeployTriggered,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/credentials/mercadopago/revoke] Unexpected error", {
      projectUrl: body.projectUrl,
      error,
    });
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }
}
