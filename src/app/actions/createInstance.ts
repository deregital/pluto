"use server";

import { CreateInstanceInput } from "@/server/schemas/project";
import { trpc } from "@/server/trpc/server";
import { updateTag } from "next/cache";

export async function createInstance(formValues: CreateInstanceInput) {
  await trpc.vercel.createInstance(formValues);
  updateTag("projects");
}
