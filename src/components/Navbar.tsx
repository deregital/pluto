import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { auth } from "@/server/auth";
import { Eclipse } from "lucide-react";

export default async function Navbar() {
  const session = await auth();

  return (
    <div className="fixed top-0 left-0 w-full h-16 bg-white dark:bg-slate-950 shadow flex items-center justify-between px-8 z-10 border-b border-slate-200 dark:border-slate-800">
      <span className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        <Eclipse />
        Pluto
      </span>
      {session && (
        <div className="flex items-center gap-8">
          <p>{session.user?.name}</p>
          <form action={signOutAction}>
            <Button type="submit">Salir</Button>
          </form>
        </div>
      )}
    </div>
  );
}
