import type { OAuthResponse } from "mercadopago/dist/clients/oAuth/commonTypes";

/**
 * Exchange authorization code for tokens, including PKCE code_verifier.
 * The official SDK types don't expose code_verifier, so we call the API directly.
 */
export async function exchangeMercadoPagoAuthorizationCode({
  code,
  redirectUri,
  codeVerifier,
}: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<OAuthResponse> {
  const clientId = process.env.MP_CLIENT_ID?.trim();
  const clientSecret = process.env.MP_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("MP_CLIENT_ID / MP_CLIENT_SECRET are not configured");
  }

  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  const payload = (await response.json()) as OAuthResponse & {
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.message ||
        payload.error ||
        `Mercado Pago token exchange failed (${response.status})`,
    );
  }

  return payload;
}
