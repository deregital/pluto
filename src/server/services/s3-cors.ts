import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  type CORSRule,
} from "@aws-sdk/client-s3";
import { getS3BucketName, getS3Client } from "@/server/services/s3-client";

const DEFAULT_CORS_RULE: CORSRule = {
  AllowedHeaders: ["*"],
  AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
  AllowedOrigins: [],
  ExposeHeaders: ["ETag"],
  MaxAgeSeconds: 3000,
};

export function normalizeCorsOrigin(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (!url.hostname) {
      return null;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function isNoSuchCorsConfiguration(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "NoSuchCORSConfiguration" ||
      (error as { Code?: string }).Code === "NoSuchCORSConfiguration")
  );
}

function appendOriginToRules(rules: CORSRule[], origin: string): CORSRule[] {
  if (rules.length === 0) {
    return [
      {
        ...DEFAULT_CORS_RULE,
        AllowedOrigins: [origin],
      },
    ];
  }

  return rules.map((rule) => {
    const origins = rule.AllowedOrigins ?? [];
    if (origins.includes(origin)) {
      return rule;
    }
    return {
      ...rule,
      AllowedOrigins: [...origins, origin],
    };
  });
}

export async function addInstanceOriginToS3Cors(
  instanceWebUrl: string,
): Promise<void> {
  const origin = normalizeCorsOrigin(instanceWebUrl);
  if (!origin) {
    return;
  }

  const s3Client = getS3Client();
  const bucketName = getS3BucketName();

  let corsRules: CORSRule[] = [];

  try {
    const response = await s3Client.send(
      new GetBucketCorsCommand({ Bucket: bucketName }),
    );
    corsRules = response.CORSRules ?? [];
  } catch (error) {
    if (!isNoSuchCorsConfiguration(error)) {
      throw error;
    }
  }

  const updatedRules = appendOriginToRules(corsRules, origin);

  await s3Client.send(
    new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: updatedRules,
      },
    }),
  );
}
