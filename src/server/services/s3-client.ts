import { S3Client } from "@aws-sdk/client-s3";

export function getS3BucketName(): string {
  const bucketUrl = process.env.NEXT_PUBLIC_S3_BUCKET_URL;
  if (!bucketUrl) {
    throw new Error("NEXT_PUBLIC_S3_BUCKET_URL is not set");
  }

  return bucketUrl
    .replace("https://", "")
    .replace("http://", "")
    .split(".s3.")[0];
}

export function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}
