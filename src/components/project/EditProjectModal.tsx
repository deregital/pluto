"use client";
import { updateTagAction } from "@/app/actions/vercel";
import { useAppForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { updateProjectSchema } from "@/server/schemas/project";
import { trpc } from "@/server/trpc/client";
import { PencilIcon } from "lucide-react";
import { useState } from "react";

export default function EditProjectModal({
  project,
}: {
  project: {
    id: string;
    instanceName: string;
    hue: number;
    saturation: number;
    instanceDescription: string;
    instanceContactEmail: string;
    instanceWebUrl: string;
  };
}) {
  const [open, setOpen] = useState(false);

  const {
    mutate: updateProject,
    isPending,
    isSuccess,
  } = trpc.vercel.updateProject.useMutation();

  const form = useAppForm({
    defaultValues: {
      instanceName: project.instanceName,
      hue: project.hue,
      saturation: project.saturation,
      instanceDescription: project.instanceDescription,
      instanceContactEmail: project.instanceContactEmail,
      databaseUrl: "",
      instanceWebUrl: project.instanceWebUrl,
    },
    validators: {
      onChange: updateProjectSchema,
    },
  });

  // TODO Send this to a server action
  const handleSubmit = () => {
    updateProject(
      {
        projectId: project.id,
        instanceName: form.state.values.instanceName,
        hue: form.state.values.hue,
        saturation: form.state.values.saturation,
        instanceDescription: form.state.values.instanceDescription,
        instanceContactEmail: form.state.values.instanceContactEmail,
        databaseUrl: form.state.values.databaseUrl,
        instanceWebUrl: form.state.values.instanceWebUrl,
      },
      {
        onSuccess: async () => {
          setOpen(false);
          await updateTagAction("projects");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={"ghost"}>
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Editar proyecto</DialogTitle>
          <DialogDescription>
            En este apartado se editan los datos de la instancia,
            específicamente las variables de entorno.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-6"
        >
          {/* Información básica de la instancia */}
          <FieldGroup>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <form.AppField
                name="instanceName"
                children={(field) => (
                  <field.TextField label="Nombre de la instancia" />
                )}
              />
              <form.AppField
                name="instanceContactEmail"
                children={(field) => (
                  <field.TextField
                    label="Email de contacto"
                    type="email"
                    placeholder="pere@example.com"
                  />
                )}
              />
            </div>
            <form.AppField
              name="instanceDescription"
              children={(field) => (
                <field.TextField label="Descripción de la instancia" />
              )}
            />
          </FieldGroup>
          <FieldGroup>
            <form.AppField
              name="instanceWebUrl"
              children={(field) => (
                <field.TextField
                  label="URL de la instancia"
                  placeholder="juanatickets.com"
                />
              )}
            />
          </FieldGroup>

          {/* Configuración visual */}
          <FieldGroup>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <form.AppField
                name="hue"
                children={(field) => (
                  <field.NumberField label="HUE (0-360)" min={0} max={360} />
                )}
              />
              <form.AppField
                name="saturation"
                children={(field) => (
                  <field.NumberField
                    label="Saturación (0-100)"
                    min={0}
                    max={100}
                  />
                )}
              />
            </div>
          </FieldGroup>

          {/* Base de datos */}
          <FieldGroup>
            <form.AppField
              name="databaseUrl"
              children={(field) => (
                <field.TextField label="URL de la base de datos" />
              )}
            />
          </FieldGroup>
          <form.AppForm>
            <form.SubmitButton>Actualizar</form.SubmitButton>
          </form.AppForm>
        </form>
      </DialogContent>
    </Dialog>
  );
}
