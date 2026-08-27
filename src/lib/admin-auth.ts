import { redirect } from "next/navigation";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth";

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
  if (!adminEmails().has(user.email.toLowerCase())) redirect("/executive-summary");
  return { supabase, user };
}
