"use client";
import { useFieldContext } from "@/components/form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { trpc } from "@/server/trpc/client";
import { useState } from "react";

export default function AvailableDomainsField() {
  const field = useFieldContext<string>();
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

  const { data: availableDomains } = trpc.vercel.getAvailableDomains.useQuery();

  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    field.handleChange(value);

    const filtered = availableDomains?.filter((s) =>
      s.name.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredSuggestions(filtered?.map((item) => item.name) || []);
    setShowSuggestions(true);
  };

  const handleSelect = (value: string) => {
    field.handleChange(value);
    setShowSuggestions(false);
  };

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>URL de la instancia</FieldLabel>
      <div className="relative w-64">
        <Input
          type="text"
          id={field.name}
          name={field.name}
          value={field.state.value ?? ""}
          onChange={handleChange}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            field.handleBlur();
            setShowSuggestions(false);
          }}
          placeholder="juanatickets.com"
        />

        {showSuggestions && filteredSuggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-sm shadow-md animate-in fade-in-80">
            {filteredSuggestions.map((s, index) => (
              <li
                key={index}
                onClick={() => handleSelect(s)}
                className="cursor-pointer px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}
