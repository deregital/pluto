import { getS3BucketName, getS3Client } from "@/server/services/s3-client";
import { vercel, vercelApi } from "@/server/services/vercel-client";
import { publicProcedure, router } from "@/server/trpc";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import z from "zod";

export const awsRouter = router({
  uploadFavicon: publicProcedure
    .input(
      z.object({
        project: z.object({
          id: z.string(),
          faviconEnvId: z.string(),
          name: z.string(),
        }),
        fileData: z.string(), // base64 encoded
        fileName: z.string(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        if (!input.project.faviconEnvId) {
          throw new Error("Favicon environment variable not found");
        }
        const s3Client = getS3Client();
        const bucketName = getS3BucketName();
        const bucketUrl = process.env.NEXT_PUBLIC_S3_BUCKET_URL!;

        // Convertir base64 a buffer
        const fileBuffer = Buffer.from(input.fileData, "base64");

        // Determinar la extensión del archivo
        const extension = input.fileName.split(".").pop() || "png";
        const key = `favicons/${input.project.name}.${extension}`;

        const { value: faviconUrl } = await vercelApi
          .get<{ value: string }>(
            `v1/projects/${input.project.id}/env/${input.project.faviconEnvId}`
          )
          .json();

        if (faviconUrl) {
          if (faviconUrl !== `${bucketUrl}/${key}`) {
            // Eliminar la imagen antigua de S3
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: bucketName,
                Key: faviconUrl.replace(`${bucketUrl}/`, ""),
              })
            );

            // Actualizar la variable de entorno NEXT_PUBLIC_FAVICON_URL del proyecto en vercel
            await vercel.projects.editProjectEnv({
              idOrName: input.project.id,
              id: input.project.faviconEnvId,
              teamId: process.env.VERCEL_TEAM_ID,
              requestBody: {
                key: "NEXT_PUBLIC_FAVICON_URL",
                value: `${bucketUrl}/${key}`,
              },
            });
          } else {
            // Reemplazar archivo en S3
            await s3Client.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: fileBuffer,
                ContentType: input.mimeType,
                CacheControl: "max-age=31536000", // Cache por 1 año
              })
            );
          }
        } else {
          // Crear la imagen en S3
          await s3Client.send(
            new PutObjectCommand({
              Bucket: bucketName,
              Key: key,
              Body: fileBuffer,
              ContentType: input.mimeType,
              CacheControl: "max-age=31536000", // Cache por 1 año
            })
          );
          // Actualizar la variable de entorno NEXT_PUBLIC_FAVICON_URL del proyecto en vercel
          await vercel.projects.editProjectEnv({
            idOrName: input.project.id,
            id: input.project.faviconEnvId,
            teamId: process.env.VERCEL_TEAM_ID,
            requestBody: {
              key: "NEXT_PUBLIC_FAVICON_URL",
              value: `${bucketUrl}/${key}`,
            },
          });
        }
      } catch (error) {
        console.error("Error uploading to S3:", error);
        throw new Error("Error al subir el archivo a S3");
      }
    }),
});
