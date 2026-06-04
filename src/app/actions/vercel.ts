"use server";

import { trpc } from "@/server/trpc/server";
import { updateTag } from "next/cache";

export async function redeployProject(projectId: string) {
  await trpc.vercel.redeployProject({
    projectId,
  });

  updateTag("deployments");
}

export async function updateTagAction(tag: string) {
  updateTag(tag);
}
