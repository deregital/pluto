import { Vercel } from "@vercel/sdk";
import ky from "ky";

export const vercelDomainTarget =
  process.env.PLANETA_DOMAIN_TARGET === "preview" ||
  process.env.PLANETA_DOMAIN_TARGET === "production"
    ? process.env.PLANETA_DOMAIN_TARGET
    : process.env.NODE_ENV === "development"
      ? "preview"
      : "production";

export const vercel = new Vercel({
  bearerToken: process.env.VERCEL_BEARER_TOKEN,
});

export const vercelApi = ky.create({
  prefixUrl: "https://api.vercel.com",
  headers: {
    Authorization: `Bearer ${process.env.VERCEL_BEARER_TOKEN}`,
  },
  searchParams: {
    teamId: process.env.VERCEL_TEAM_ID,
  },
});
