import DomainsInfo from "@/components/general/DomainsInfo";
import CreateProjectModal from "@/components/project/CreateProjectModal";
import ProjectsList from "@/components/project/ProjectsList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/server/auth";
import { trpc } from "@/server/trpc/server";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const { projects } = await trpc.vercel.getProjects();
  return (
    <div className="flex flex-col gap-4 justify-center items-center container mx-auto mt-20 px-4 mb-4">
      <Card className="relative w-full lg:w-3/5">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/calendar">
              <CalendarDays />
              Calendario
            </Link>
          </Button>
          <CreateProjectModal />
        </div>
        <CardHeader>
          <CardTitle>Dominios</CardTitle>
        </CardHeader>
        <CardContent>
          <DomainsInfo />
        </CardContent>
      </Card>
      <ProjectsList projects={projects} />
    </div>
  );
}
