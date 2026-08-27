import { AppShell } from "@/components/app-shell";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: profile } = await createSupabaseServiceRoleClient()
    .from("t_app_user")
    .select("name,access_revenue_dashboard")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.access_revenue_dashboard && !isAdminEmail(user.email ?? "")) {
    await supabase.auth.signOut();
    redirect("/login?error=Akun%20tidak%20memiliki%20akses%20ke%20dashboard%20revenue.");
  }

  return (
    <AppShell
      userName={profile?.name}
      email={user?.email}
    >
      {children}
    </AppShell>
  );
}
