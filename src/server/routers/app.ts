import { awsRouter } from "@/server/routers/aws";
import { vercelRouter } from "@/server/routers/vercel";
import { router } from "@/server/trpc";

export const appRouter = router({
  vercel: vercelRouter,
  aws: awsRouter,
});

export type AppRouter = typeof appRouter;
