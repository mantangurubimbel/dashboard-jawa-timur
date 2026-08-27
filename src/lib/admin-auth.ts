import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth";

export function isAdminEmail(email: string) {
  return adminEmails().has(email.toLowerCase());
}

function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireAdmin() {
  const supabase = await createSupabaseAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/forbidden");
  return { supabase, user };
}
