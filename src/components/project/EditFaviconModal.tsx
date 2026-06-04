"use client";
import { updateTagAction } from "@/app/actions/vercel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "@/components/ui/shadcn-io/dropzone";
import { RouterOutput } from "@/server/trpc";
import { trpc } from "@/server/trpc/client";
import { Loader2, PencilIcon } from "lucide-react";
import { useState } from "react";

export default function EditFaviconModal({
  project,
}: {
  project: RouterOutput["vercel"]["getProjects"]["projects"][number];
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFaviconMutation = trpc.aws.uploadFavicon.useMutation({
    onSuccess: () => {
      setSelectedFile(null);
      setIsOpen(false);
      setError(null);
    },
    onError: (error) => {
      setError(`Error al actualizar favicon: ${error.message}`);
      setIsUploading(false);
    },
  });

  const validateImageDimensions = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const isSquare = img.width === img.height;
        resolve(isSquare);
      };
      img.onerror = () => resolve(false);
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (files: File[]) => {
    setError(null); // Limpiar errores previos

    if (files.length > 0) {
      const file = files[0];

      // Validar que sea PNG específicamente
      if (file.type !== "image/png") {
        setError("Solo se aceptan archivos PNG");
        return;
      }

      // Validar tamaño (máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError("El archivo debe ser menor a 2MB");
        return;
      }

      // Validar que sea cuadrado
      const isSquare = await validateImageDimensions(file);
      if (!isSquare) {
        setError("La imagen debe ser cuadrada (mismo ancho y alto)");
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      // Convertir archivo a base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(",")[1]; // Remover el prefijo data:image/...;base64,

        uploadFaviconMutation.mutate({
          project: {
            id: project.id,
            faviconEnvId:
              project.env?.find(
                (e: { key: string }) => e.key === "NEXT_PUBLIC_FAVICON_URL",
              )?.id ?? "",
            name: project.name,
          },
          fileData: base64Data,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
        });
      };
      reader.readAsDataURL(selectedFile);

      await updateTagAction("projects");
    } catch (error) {
      setError("Error al procesar el archivo");
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setError(null);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={"secondary"} className="absolute top-0 right-0">
          <PencilIcon className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Favicon</DialogTitle>
          <DialogDescription>
            La imagen debe ser cuadrada (mismo ancho y alto) y el único formato
            aceptado es PNG. Podes usar{" "}
            <a className="underline" href="https://favicon.io/" target="_blank">
              https://favicon.io
            </a>{" "}
            o{" "}
            <a
              className="underline"
              href="https://squareanimage.com/"
              target="_blank"
            >
              https://squareanimage.com
            </a>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Dropzone
            src={selectedFile ? [selectedFile] : undefined}
            onDrop={handleFileSelect}
            accept={{
              "image/png": [".png"],
            }}
            maxSize={2 * 1024 * 1024} // 2MB
            maxFiles={1}
            className="min-h-[120px]"
          >
            <DropzoneEmptyState />
            <DropzoneContent />
          </Dropzone>

          {error && (
            <div className="rounded-md bg-red-50 p-3 border border-red-200">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {selectedFile && (
            <div className="text-sm text-muted-foreground">
              <p>
                <strong>Archivo seleccionado:</strong> {selectedFile.name}
              </p>
              <p>
                <strong>Tamaño:</strong> {(selectedFile.size / 1024).toFixed(1)}{" "}
                KB
              </p>
              <p>
                <strong>Tipo:</strong> {selectedFile.type}
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button
              variant={"ghost"}
              onClick={handleCancel}
              disabled={isUploading || uploadFaviconMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                !selectedFile || isUploading || uploadFaviconMutation.isPending
              }
            >
              {(isUploading || uploadFaviconMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isUploading || uploadFaviconMutation.isPending
                ? "Subiendo..."
                : "Subir Favicon"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
