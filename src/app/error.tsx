"use client"; // Error boundaries must be Client Components

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <Card className="p-8 w-1/2">
        <CardHeader>
          <CardTitle>Ocurrio un error :(</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm w-full text-red-500">
            {error.message || "Error desconocido"}
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={() => reset()}>Proba de nuevo</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
