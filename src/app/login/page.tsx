import { redirect } from "next/navigation";
import { signIn } from "@/app/auth/actions";
import { PasswordInput } from "@/components/password-input";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;

  if (user) {
    redirect("/executive-summary");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-700 text-sm font-bold text-white">
            JT
          </span>
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">Jawa Timur</p>
            <h1 className="text-xl font-semibold text-slate-950">Revenue Dashboard</h1>
          </div>
        </div>
        <p className="mt-6 text-sm text-slate-600">
          Masuk menggunakan akun yang sudah terdaftar di Supabase Auth.
        </p>

        {params.error ? (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {params.error}
          </div>
        ) : null}

        <form action={signIn} className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Password
            <PasswordInput
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button
            type="submit"
            className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
          >
            Masuk
          </button>
        </form>
      </section>
    </main>
  );
}
