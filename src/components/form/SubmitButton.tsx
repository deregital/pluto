import { useFormContext } from "@/components/form";
import { Button } from "@/components/ui/button";
import { useStore } from "@tanstack/react-form";
import React from "react";

export default function SubmitButton({
  children,
  disabled,
}: {
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const form = useFormContext();

  const [isSubmitting, canSubmit] = useStore(form.store, (state) => [
    state.isSubmitting,
    state.canSubmit,
  ]);

  return (
    <Button
      type="submit"
      disabled={isSubmitting || !canSubmit || disabled}
      className="w-full mt-4"
    >
      {children}
    </Button>
  );
}
