import {
  generateCodeChallenge,
  generateCodeVerifier,
  getPkceCookieMaxAgeSeconds,
  getPkceVerifierCookieName,
} from "@/server/security/pkce";
import { createOAuthState } from "@/server/security/oauth-state";
import { verifySignedPayload } from "@/server/security/signed-request";
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

/**
 * Starts Mercado Pago OAuth with PKCE.
 * Planeta Nocturno signs the instance URL before linking to this endpoint.
 */
export async function GET(request: NextRequest) {
  const instanceUrlParam = request.nextUrl.searchParams.get("instance_url");
  const timestamp = request.nextUrl.searchParams.get("timestamp");
  const signature = request.nextUrl.searchParams.get("signature");
  if (!instanceUrlParam || !timestamp || !signature) {
    return new NextResponse(
      "Faltan parámetros para iniciar la conexión con Mercado Pago.",
      { status: 400 },
    );
  }

  if (
    !verifySignedPayload({
      timestamp,
      rawBody: instanceUrlParam,
      signature,
    })
  ) {
    return new NextResponse("Solicitud no autorizada.", { status: 401 });
  }

  const instanceUrl = normalizeInstanceUrl(instanceUrlParam);
  const redirectUri = getRedirectUri();
  const clientId = process.env.MP_CLIENT_ID?.trim();

  if (!redirectUri || !clientId) {
    return new NextResponse(
      "INSTANCE_URL / MP_CLIENT_ID no están configurados en Pluto.",
      { status: 500 },
    );
  }

  const { project } = await findPlanetaProjectByHostname(instanceUrl);
  if (!project) {
    return new NextResponse(
      `No se encontró un proyecto Vercel para la instancia: ${instanceUrl}`,
      { status: 404 },
    );
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const authUrl = new URL("https://auth.mercadopago.com/authorization");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("platform_id", "mp");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", createOAuthState(instanceUrl));
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set(getPkceVerifierCookieName(), codeVerifier, {
    httpOnly: true,
    secure: redirectUri.startsWith("https://"),
    sameSite: "lax",
    path: "/oauth",
    maxAge: getPkceCookieMaxAgeSeconds(),
  });

  return response;
}
