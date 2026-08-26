"use client";

import { useState } from "react";

import { parseNumericDraft } from "@/lib/numeric-form-input";

type NumericFieldInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  validate: (value: string) => string | null;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  inputClassName?: string;
};

export function NumericFieldInput({
  id,
  label,
  value,
  onChange,
  validate,
  onCommit,
  min,
  max,
  className = "block text-sm",
  inputClassName = "w-full min-h-11 rounded-md border border-slate-300 px-3 py-2",
}: NumericFieldInputProps) {
  const [touched, setTouched] = useState(false);
  const validationError = validate(value);

  function handleBlur() {
    setTouched(true);

    if (validationError) {
      return;
    }

    const parsed = parseNumericDraft(value);

    if (parsed === null) {
      return;
    }

    onCommit(Math.round(parsed));
  }

  return (
    <label className={className} htmlFor={id}>
      <span className="mb-1 block font-medium">{label}</span>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={handleBlur}
        aria-invalid={touched && validationError ? true : undefined}
        className={inputClassName}
      />
      {touched && validationError ? (
        <p className="mt-1 text-sm text-red-700" role="alert">
          {validationError}
        </p>
      ) : null}
    </label>
  );
}

export function resolveNumericDraft(
  draft: string | undefined,
  persistedValue: number
): string {
  return draft ?? String(persistedValue);
}
