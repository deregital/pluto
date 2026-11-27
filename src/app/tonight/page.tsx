import { redirect } from "next/navigation";

import TonightDashboard from "@/components/tonight/TonightDashboard";
import { auth } from "@/server/auth";
import { getTonightBoard } from "@/server/services/guardia/tonight";

export default async function TonightPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  if (!process.env.PLUTO_DATABASE_URL?.trim()) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-24">
        <p className="rounded-md border bg-card p-4 text-sm">
          Falta configurar <code>PLUTO_DATABASE_URL</code>: la guardia guarda la
          agenda en la base de Pluto.
        </p>
      </div>
    );
  }

  return <TonightDashboard board={await getTonightBoard()} />;
}
