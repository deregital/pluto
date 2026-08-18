import { createHmac, timingSafeEqual } from "node:crypto";

const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

type OAuthState = {
  instanceUrl: string;
  issuedAt: number;
};

function getStateSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return secret;
}

export function createOAuthState(instanceUrl: string) {
  const payload = Buffer.from(
    JSON.stringify({ instanceUrl, issuedAt: Date.now() } satisfies OAuthState),
  ).toString("base64url");
  const signature = createHmac("sha256", getStateSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function readOAuthState(value: string): OAuthState {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) throw new Error("Invalid OAuth state");

  const expectedSignature = createHmac("sha256", getStateSecret())
    .update(payload)
    .digest("base64url");
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new Error("Invalid OAuth state signature");
  }

  const state = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as Partial<OAuthState>;
  if (
    typeof state.instanceUrl !== "string" ||
    typeof state.issuedAt !== "number" ||
    Date.now() - state.issuedAt > OAUTH_STATE_MAX_AGE_MS ||
    state.issuedAt > Date.now()
  ) {
    throw new Error("Expired or invalid OAuth state");
  }

  return state as OAuthState;
}
