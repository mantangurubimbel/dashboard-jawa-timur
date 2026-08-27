"use client";

import { KeyRound, LogOut, User, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/auth/actions";

function LogoutAction() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[12px] leading-5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
    >
      <LogOut className="h-4 w-4 text-slate-500" aria-hidden />
      <span className="text-[12px] leading-5">{pending ? "Keluar..." : "Keluar"}</span>
    </button>
  );
}

export function AccountMenu({
  userName,
  email,
}: {
  userName?: string | null;
  email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
          <Link
            href="/change-password"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <KeyRound className="h-4 w-4 text-slate-500" aria-hidden />
            <span>Ganti password</span>
          </Link>
          <form action={signOut}>
            <LogoutAction />
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
        aria-label={`Menu akun ${userName || email || ""}`.trim()}
        title={userName || email || "Menu akun"}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {open ? <X className="h-4 w-4" aria-hidden /> : <User className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
