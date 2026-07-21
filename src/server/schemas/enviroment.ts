import { UpdateProjectInput } from "@/server/schemas/project";
import z from "zod";

export const projectEnvsSchema = z.object({
  instanceName: z.string().min(3, {
    error: "El nombre de la instancia debe tener al menos 3 caracteres",
  }),
  instanceDescription: z.string().min(3, {
    error: "La descripción de la instancia debe tener al menos 3 caracteres",
  }),
  hue: z
    .number()
    .min(0, {
      error: "El hue debe ser mayor o igual a 0",
    })
    .max(360, {
      error: "El hue debe ser menor o igual a 360",
    }),
  saturation: z
    .number()
    .min(0, {
      error: "La saturación debe ser mayor o igual a 0",
    })
    .max(100, {
      error: "La saturación debe ser menor o igual a 100",
    }),
  instanceContactEmail: z.email({
    error: "El email de contacto no es válido",
  }),
  databaseUrl: z.string(),
  instanceWebUrl: z.string(),
});

export const UPDATABLE_ENVS = [
  "NEXT_PUBLIC_INSTANCE_NAME",
  "NEXT_PUBLIC_INSTANCE_DESCRIPTION",
  "NEXT_PUBLIC_SATURATION",
  "NEXT_PUBLIC_HUE",
  "INSTANCE_CONTACT_EMAIL",
  "DATABASE_URL",
  "INSTANCE_WEB_URL",
] as const;

export const PUBLIC_ENVS = [
  "NEXT_PUBLIC_INSTANCE_NAME",
  "NEXT_PUBLIC_INSTANCE_DESCRIPTION",
  "NEXT_PUBLIC_HUE",
  "NEXT_PUBLIC_SATURATION",
  "INSTANCE_CONTACT_EMAIL",
  "INSTANCE_WEB_URL",
  "NEXT_PUBLIC_FAVICON_URL",
] as const;

export const ENV_TO_INPUT_KEY: Record<
  (typeof UPDATABLE_ENVS)[number],
  keyof UpdateProjectInput
> = {
  NEXT_PUBLIC_INSTANCE_NAME: "instanceName",
  NEXT_PUBLIC_INSTANCE_DESCRIPTION: "instanceDescription",
  NEXT_PUBLIC_HUE: "hue",
  NEXT_PUBLIC_SATURATION: "saturation",
  INSTANCE_CONTACT_EMAIL: "instanceContactEmail",
  DATABASE_URL: "databaseUrl",
  INSTANCE_WEB_URL: "instanceWebUrl",
};
