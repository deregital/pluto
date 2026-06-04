import ProjectCard from "@/components/project/ProjectCard";
import { RouterOutput } from "@/server/trpc";

export default function ProjectsList({
  projects,
}: {
  projects: RouterOutput["vercel"]["getProjects"]["projects"];
}) {
  return (
    <div className="flex flex-col gap-4 w-full lg:w-3/5">
      {projects.map((project) => (
        <div key={project.id}>
          <ProjectCard project={project} />
        </div>
      ))}
    </div>
  );
}
