import DeleteProjectModal from "@/components/project/DeleteProjectModal";
import EditFaviconModal from "@/components/project/EditFaviconModal";
import EditProjectModal from "@/components/project/EditProjectModal";
import FaviconImage from "@/components/project/FaviconImage";
import LastDeployments from "@/components/project/LastDeployments";
import RedeployModal from "@/components/project/RedeployModal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hslToHex } from "@/lib/utils";
import { RouterOutput } from "@/server/trpc";
import { trpc } from "@/server/trpc/server";
import { format } from "date-fns";
import Link from "next/link";

export default async function ProjectCard({
  project,
}: {
  project: RouterOutput["vercel"]["getProjects"]["projects"][number];
}) {
  if (!project.env) {
    return null;
  }

  const publicEnv = await trpc.vercel.getPublicEnv({
    projectId: project.id,
    envs: project.env
      .map((ev) => ({ id: ev.id ?? "", key: ev.key }))
      .filter((ev) => ev.id !== ""),
  });

  const hexColor = hslToHex(parseInt(publicEnv.NEXT_PUBLIC_HUE), 100, 60);

  const deployments = await trpc.vercel.getDeployments({
    projectId: project.id,
  });

  const masterDeployment = await trpc.vercel.getMasterDeployment({
    projectId: project.id,
  });

  return (
    <Card
      className="border-2 relative flex flex-row gap-2"
      style={{ borderColor: hexColor }}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LastDeployments
          masterDeployment={masterDeployment}
          deployments={deployments}
        />
        <EditProjectModal
          project={{
            id: project.id,
            instanceName: publicEnv.NEXT_PUBLIC_INSTANCE_NAME,
            hue: Number(publicEnv.NEXT_PUBLIC_HUE),
            saturation: Number(publicEnv.NEXT_PUBLIC_SATURATION),
            instanceDescription: publicEnv.NEXT_PUBLIC_INSTANCE_DESCRIPTION,
            instanceContactEmail: publicEnv.INSTANCE_CONTACT_EMAIL,
            instanceWebUrl: publicEnv.INSTANCE_WEB_URL,
          }}
        />
      </div>
      <div className="absolute bottom-4 right-4">
        <DeleteProjectModal projectName={project.name} />
        <RedeployModal projectId={project.id} />
      </div>
      <div className="relative flex items-center justify-center ml-4">
        <FaviconImage faviconUrl={publicEnv.NEXT_PUBLIC_FAVICON_URL} />
        <EditFaviconModal project={project} />
      </div>
      <div className="flex flex-col justify-between w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>
              {publicEnv.NEXT_PUBLIC_INSTANCE_NAME}{" "}
              <span className=" text-slate-500">({project.name})</span>
            </span>
          </CardTitle>
          <CardDescription>
            HUE: {publicEnv.NEXT_PUBLIC_HUE}
            {project.domain && (
              <Link target="_blank" href={project.domain}>
                <span className="ml-2 text-green-600 dark:text-green-400">
                  • <span className="hover:underline">{project.domain}</span>
                </span>
              </Link>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Última actualización:{" "}
            {format(project.updatedAt ?? new Date(), "dd/MM/yyyy HH:mm:ss")}
          </p>
        </CardContent>
      </div>
    </Card>
  );
}
