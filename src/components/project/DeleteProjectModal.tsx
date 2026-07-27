"use client";
import { updateTagAction } from "@/app/actions/vercel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteProjectModal({
  projectName,
}: {
  projectName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmation, setConfirmation] = useState("");

  const deleteProject = trpc.vercel.deleteProject.useMutation({
    onSuccess: async () => {
      await updateTagAction("projects");
      handleOpenChange(false);
      router.refresh();
    },
  });

  const canDelete = confirmation === projectName;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setStep(1);
      setConfirmation("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <TrashIcon className="w-4 h-4 text-red-500" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Eliminar proyecto</DialogTitle>
              <DialogDescription>
                Esta acción es irreversible. Se eliminará el proyecto{" "}
                <span className="font-bold">{projectName}</span> y todos sus
                recursos asociados.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="destructive" onClick={() => setStep(2)}>
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirmar eliminación</DialogTitle>
              <DialogDescription>
                Para confirmar, escribí el nombre del proyecto{" "}
                <span className="font-bold">{projectName}</span>.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={projectName}
              autoFocus
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(1)}>
                Volver
              </Button>
              <Button
                variant="destructive"
                disabled={!canDelete || deleteProject.isPending}
                onClick={() => deleteProject.mutate(projectName)}
              >
                {deleteProject.isPending ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
