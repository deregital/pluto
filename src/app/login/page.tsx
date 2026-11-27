import { GoogleIcon } from "@/components/icons/Google";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth, signIn } from "@/server/auth";
import { Eclipse } from "lucide-react";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) {
    redirect("/");
  }
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-white/70 ring-1 ring-slate-200 flex items-center justify-center">
            <Eclipse className="h-6 w-6 text-slate-700" />
          </div>
          <CardTitle className="text-2xl tracking-tight">
            Iniciar sesión
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200"
            >
              {error === "AccessDenied"
                ? "Esa cuenta no tiene acceso a Pluto."
                : "No pudimos iniciar sesión. Probá de nuevo."}
            </p>
          )}
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <Button
              type="submit"
              variant="outline"
              className="w-full h-11 gap-2 bg-white text-slate-900 hover:bg-slate-50"
            >
              <GoogleIcon className="h-5 w-5" />
              Continuar con Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
  // return <LoginClient />;
}
