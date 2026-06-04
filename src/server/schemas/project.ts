import { projectEnvsSchema } from "@/server/schemas/enviroment";
import z from "zod";

export const projectSchema = z.object({
  envs: projectEnvsSchema,
  name: z
    .string()
    .min(3, {
      message: "El nombre del projecto debe tener minimo 3 caracteres",
    })
    .toLowerCase()
    .trim()
    .transform((str) => str.replace(/\s+/g, "-")),
  seed: z.object({
    name: z.string().min(3, {
      message: "El nombre del administrador debe tener minimo 3 caracteres",
    }),
    password: z.string().min(3, {
      message: "La contraseña del administrador debe tener minimo 3 caracteres",
    }),
    email: z.email({
      message: "El email del administrador no es valido",
    }),
    fullName: z.string().min(3, {
      message:
        "El nombre completo del administrador debe tener minimo 3 caracteres",
    }),
  }),
});

export const createInstanceSchema = projectSchema;

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;

export const updateProjectSchema = projectEnvsSchema;

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
