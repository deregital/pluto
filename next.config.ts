import type { NextConfig } from "next";

// Allow Next/Image to load favicons from the configured S3 bucket. The hostname
// is derived from NEXT_PUBLIC_S3_BUCKET_URL so no bucket name is hardcoded
// (see .env.example).
function getS3Hostname(): string | undefined {
  const url = process.env.NEXT_PUBLIC_S3_BUCKET_URL;
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

const s3Hostname = getS3Hostname();

const nextConfig: NextConfig = {
  serverExternalPackages: ["libsodium-wrappers", "libsodium"],
  reactCompiler: true,
  images: {
    remotePatterns: s3Hostname
      ? [
          {
            protocol: "https",
            hostname: s3Hostname,
          },
        ]
      : [],
  },
};

export default nextConfig;
