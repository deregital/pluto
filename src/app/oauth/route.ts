import { getPkceVerifierCookieName } from "@/server/security/pkce";
import { updateMercadoPagoCredentials } from "@/server/services/mercadopago-credentials";
import { exchangeMercadoPagoAuthorizationCode } from "@/server/services/mercadopago-oauth";
import { findPlanetaProjectByHostname } from "@/server/services/planeta-projects";
import { NextRequest, NextResponse } from "next/server";

function normalizeInstanceUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

function getRedirectUri() {
  const base = process.env.INSTANCE_URL?.trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/oauth`;
}

function redirectToInstanceSettings(
  instanceUrl: string,
  status: "success" | "error",
) {
  const baseUrl = normalizeInstanceUrl(instanceUrl);
  return NextResponse.redirect(`${baseUrl}/admin/settings?mp=${status}`);
}

function clearPkceCookie(response: NextResponse) {
  response.cookies.set(getPkceVerifierCookieName(), "", {
    httpOnly: true,
    path: "/oauth",
    maxAge: 0,
  });
}

/**
 * Mercado Pago OAuth callback (authorization code + PKCE).
 * Expects `code` and `state` (instance URL) from Mercado Pago.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? undefined;
  const state = request.nextUrl.searchParams.get("state") ?? undefined;

  if (!code || !state) {
    return new NextResponse(
      "Error de autorización: faltan parámetros requeridos (code o state).",
      { status: 400 },
    );
  }

  const instanceUrl = normalizeInstanceUrl(state);
  const codeVerifier = request.cookies.get(getPkceVerifierCookieName())?.value;

  try {
    const redirectUri = getRedirectUri();
    if (!redirectUri) {
      throw new Error("INSTANCE_URL is not configured");
    }

    if (!codeVerifier) {
      throw new Error(
        "Missing PKCE code_verifier cookie. Restart OAuth from /oauth/start",
      );
    }

    const credentials = await exchangeMercadoPagoAuthorizationCode({
      code,
      redirectUri,
      codeVerifier,
    });

    if (!credentials.access_token || !credentials.refresh_token) {
      throw new Error("Mercado Pago did not return access or refresh token");
    }

    const { project } = await findPlanetaProjectByHostname(instanceUrl);
    if (!project) {
      throw new Error(`No project found for instance URL: ${instanceUrl}`);
    }

    await updateMercadoPagoCredentials({
      projectId: project.id,
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token,
    });

    const successResponse = redirectToInstanceSettings(instanceUrl, "success");
    clearPkceCookie(successResponse);
    return successResponse;
  } catch (error) {
    console.error("[oauth] Mercado Pago OAuth callback failed", {
      instanceUrl,
      error,
    });
    const errorResponse = redirectToInstanceSettings(instanceUrl, "error");
    clearPkceCookie(errorResponse);
    return errorResponse;
  }
}
