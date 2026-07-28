import AvailableDomainsField from "@/components/form/AvailableDomainsField";
import ColorPickerField from "@/components/form/ColorPickerField";
import NumberField from "@/components/form/NumberField";
import SubmitButton from "@/components/form/SubmitButton";
import TextField from "@/components/form/TextField";
import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

export const { fieldContext, useFieldContext, formContext, useFormContext } =
  createFormHookContexts();

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
    NumberField,
    AvailableDomainsField,
    ColorPickerField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
});
