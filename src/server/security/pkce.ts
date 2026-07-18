import { createHash, randomBytes } from "node:crypto";

const PKCE_VERIFIER_COOKIE = "mp_oauth_code_verifier";
const PKCE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

/** Characters allowed by RFC 7636 for code_verifier. */
const VERIFIER_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

export function getPkceVerifierCookieName() {
  return PKCE_VERIFIER_COOKIE;
}

export function getPkceCookieMaxAgeSeconds() {
  return PKCE_COOKIE_MAX_AGE_SECONDS;
}

/**
 * Generates a high-entropy code_verifier (43–128 chars) per RFC 7636.
 */
export function generateCodeVerifier(length = 64): string {
  if (length < 43 || length > 128) {
    throw new Error("code_verifier length must be between 43 and 128");
  }

  const bytes = randomBytes(length);
  let verifier = "";
  for (let i = 0; i < length; i++) {
    verifier += VERIFIER_CHARSET[bytes[i]! % VERIFIER_CHARSET.length];
  }
  return verifier;
}

/**
 * BASE64URL(SHA256(code_verifier)) without padding — method S256.
 */
export function generateCodeChallenge(codeVerifier: string): string {
  return createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
