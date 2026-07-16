import { findPlanetaProjectByHostname } from "@/server/services/planeta-projects";
import { trpc } from "@/server/trpc/server";
import MercadoPagoConfig, { OAuth } from "mercadopago";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

function normalizeInstanceUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function redirectToInstanceSettings(
  instanceUrl: string,
  status: "success" | "error",
) {
  const baseUrl = normalizeInstanceUrl(instanceUrl);
  redirect(`${baseUrl}/admin/settings?mp=${status}`);
}

export default async function OAuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : undefined;
  const state = typeof params.state === "string" ? params.state : undefined;

  if (!code || !state) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h1 className="text-2xl font-bold">Error de autorización</h1>
        <p className="text-muted-foreground">
          Faltan parámetros requeridos (code o state).
        </p>
      </div>
    );
  }

  const instanceUrl = normalizeInstanceUrl(state);

  try {
    const redirectUri = `${process.env.INSTANCE_URL}/oauth`;
    if (!redirectUri) {
      throw new Error("MP_REDIRECT_URI is not configured");
    }

    const client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
    const oauth = new OAuth(client);

    const credentials = await oauth.create({
      body: {
        client_id: process.env.MP_CLIENT_ID!,
        client_secret: process.env.MP_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
      },
    });

    if (!credentials.access_token || !credentials.refresh_token) {
      throw new Error("Mercado Pago did not return access or refresh token");
    }

    const { project } = await findPlanetaProjectByHostname(instanceUrl);
    if (!project) {
      throw new Error(`No project found for instance URL: ${instanceUrl}`);
    }

    await trpc.vercel.updateMercadoPagoCredentials({
      projectId: project.id,
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("[oauth] Mercado Pago OAuth callback failed", {
      instanceUrl,
      error,
    });
    redirectToInstanceSettings(instanceUrl, "error");
  }

  redirectToInstanceSettings(instanceUrl, "success");
}
