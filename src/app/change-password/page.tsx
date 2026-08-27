import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { changePassword } from "@/app/auth/actions";
import { PasswordInput } from "@/components/password-input";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;

  if (!user) {
    return null;
  }

  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <Link
          href="/revenue"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali ke dashboard
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <KeyRound className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">Keamanan akun</p>
            <h1 className="text-xl font-semibold text-slate-950">Ganti password</h1>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          Password baru minimal 8 karakter. Setelah berhasil, Anda akan diminta login kembali.
        </p>

        {params.error ? (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {params.error}
          </div>
        ) : null}

        <form action={changePassword} className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Password lama
            <PasswordInput
              name="current_password"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Password baru
            <PasswordInput
              name="new_password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Konfirmasi password baru
            <PasswordInput
              name="confirm_password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <button
            type="submit"
            className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Simpan password
          </button>
        </form>
      </section>
    </main>
  );
}
