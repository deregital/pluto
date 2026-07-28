import { HsColorPicker } from "@/components/color-picker";
import { useFieldContext } from "@/components/form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { useStore } from "@tanstack/react-form";

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export default function ColorPickerField({
  label,
  saturationName,
}: {
  label: string;
  saturationName: string;
}) {
  const hueField = useFieldContext<number>();
  const form = hueField.form;
  const saturation = useStore(
    form.store,
    (state) => (getByPath(state.values, saturationName) as number) ?? 100,
  );

  const hue = hueField.state.value ?? 0;
  const isInvalid = hueField.state.meta.isTouched && !hueField.state.meta.isValid;

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel>{label}</FieldLabel>
      <HsColorPicker
        value={{ hue, saturation }}
        onChange={({ hue: nextHue, saturation: nextSaturation }) => {
          hueField.handleChange(nextHue);
          (
            form.setFieldValue as unknown as (
              name: string,
              value: number,
            ) => void
          )(saturationName, nextSaturation);
        }}
        onBlur={hueField.handleBlur}
      />
      {isInvalid && <FieldError errors={hueField.state.meta.errors} />}
    </Field>
  );
}
