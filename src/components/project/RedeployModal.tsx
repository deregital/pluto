"use client";
import { redeployProject } from "@/app/actions/vercel";
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
import { RefreshCcwDot } from "lucide-react";
import { useState } from "react";

export default function RedeployModal({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  async function handleSubmit() {
    await redeployProject(projectId);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={"ghost"}>
          <RefreshCcwDot />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            ¿Estas seguro de querer redeployar la instancia?
          </DialogTitle>
          <DialogDescription>
            Esta acción tardará unos minutos. Y los servidores estarán{" "}
            <span className="font-bold">fuera de servicio</span> durante ese
            periodo de tiempo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant={"destructive"} onClick={handleSubmit}>
            Redeployar
          </Button>
          <DialogClose asChild>
            <Button variant={"ghost"}>Cancelar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
