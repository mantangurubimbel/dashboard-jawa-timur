"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordInputProps = {
  name: string;
  autoComplete: string;
  minLength?: number;
  required?: boolean;
};

export function PasswordInput({
  name,
  autoComplete,
  minLength,
  required,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        className="h-10 w-full rounded-md border border-slate-300 px-3 pr-10 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-400 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-600"
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        title={visible ? "Sembunyikan password" : "Tampilkan password"}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
