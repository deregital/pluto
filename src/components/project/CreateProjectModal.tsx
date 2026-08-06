"use client";
import { createInstance } from "@/app/actions/createInstance";
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
import { createInstanceSchema } from "@/server/schemas/project";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export default function CreateProjectModal() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const form = useAppForm({
    defaultValues: {
      envs: {
        instanceName: "",
        instanceDescription: "",
        instanceContactEmail: "",
        hue: 0,
        saturation: 100,
        instanceWebUrl: "",
      },
      name: "",
      seed: {
        name: "",
        password: "",
        email: "",
        fullName: "",
      },
    },

    validators: {
      onChange: createInstanceSchema,
    },
  });

  async function handleSubmit() {
    setSending(true);
    await createInstance(form.state.values);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Crear Instancia</Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Crear instancia</DialogTitle>
          <DialogDescription>
            Tené a mano todos los datos necesarios
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-6"
        >
          {sending ? (
            <div className="flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <>
              {/* Información básica del proyecto */}
              <FieldGroup>
                {/* TODO: Change in real time with lowercase and "-" (this field) */}
                <form.AppField
                  name="name"
                  children={(field) => (
                    <field.TextField
                      label="Nombre del proyecto"
                      placeholder="pluto-tickets"
                    />
                  )}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <form.AppField
                    name="envs.instanceName"
                    children={(field) => (
                      <field.TextField
                        label="Nombre de la instancia"
                        placeholder="Pluto Tickets"
                      />
                    )}
                  />
                  <form.AppField
                    name="envs.instanceContactEmail"
                    children={(field) => (
                      <field.TextField
                        label="Email de contacto"
                        type="email"
                        placeholder="pluto@tickets.com"
                      />
                    )}
                  />
                </div>
                <form.AppField
                  name="envs.instanceDescription"
                  children={(field) => (
                    <field.TextField
                      label="Descripción de la instancia"
                      placeholder="Pluto Tickets es una plataforma de tickets para eventos..."
                    />
                  )}
                />
              </FieldGroup>
              <FieldGroup>
                <form.AppField
                  name="envs.instanceWebUrl"
                  children={(field) => <field.AvailableDomainsField />}
                />
              </FieldGroup>

              {/* Configuración visual */}
              <FieldGroup>
                <form.AppField
                  name="envs.hue"
                  children={(field) => (
                    <field.ColorPickerField
                      label="Color de la instancia"
                      saturationName="envs.saturation"
                    />
                  )}
                />
              </FieldGroup>

              {/* Seed */}
              <FieldGroup>
                <p className="text-sm text-gray-500">Usuario administrador</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <form.AppField
                    name="seed.name"
                    children={(field) => <field.TextField label="Nombre" />}
                  />
                  <form.AppField
                    name="seed.password"
                    children={(field) => <field.TextField label="Contraseña" />}
                  />
                  <form.AppField
                    name="seed.email"
                    children={(field) => <field.TextField label="Email" />}
                  />
                  <form.AppField
                    name="seed.fullName"
                    children={(field) => (
                      <field.TextField label="Nombre completo" />
                    )}
                  />
                </div>
              </FieldGroup>
            </>
          )}
          <form.AppForm>
            <form.SubmitButton disabled={sending}>
              {sending ? "Creando..." : "Crear"}
            </form.SubmitButton>
          </form.AppForm>
        </form>
      </DialogContent>
    </Dialog>
  );
}
