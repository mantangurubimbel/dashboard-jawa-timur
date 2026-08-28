"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/auth/actions";

function LogoutButtonContent() {
  const { pending } = useFormStatus();

  return (
    <>
      <LogOut className="h-4 w-4" aria-hidden />
      <span>{pending ? "Signing out..." : "Sign out"}</span>
    </>
  );
}

export function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        title="Sign out of the dashboard"
      >
        <LogoutButtonContent />
      </button>
    </form>
  );
}
