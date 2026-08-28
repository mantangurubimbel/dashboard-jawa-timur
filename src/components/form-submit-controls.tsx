"use client";

import { LoaderCircle } from "lucide-react";
import { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function FormPendingIndicator({
  className = "h-4 w-4 text-teal-700",
}: {
  className?: string;
}) {
  const { pending } = useFormStatus();
  return pending ? <LoaderCircle className={`animate-spin ${className}`} aria-label="Saving" /> : null;
}

export function PendingSubmitButton({
  children,
  ...props
}: ComponentProps<"button"> & { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button {...props} type={props.type ?? "submit"} disabled={pending || props.disabled}>
      {children}
    </button>
  );
}
