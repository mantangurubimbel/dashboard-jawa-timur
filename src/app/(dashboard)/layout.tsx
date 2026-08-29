import { AppShell } from "@/components/app-shell";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth";
import { redirect } from "next/navigation";
import { getDashboardUserContext } from "@/lib/dashboard-access";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await getDashboardUserContext();
  if (!context.user) {
    redirect("/login");
  }
  if (!context.hasDashboardAccess) {
    const supabase = await createSupabaseAuthServerClient();
    await supabase.auth.signOut();
    redirect("/login?error=This%20account%20does%20not%20have%20access%20to%20the%20Revenue%20Dashboard.");
  }

  return (
    <AppShell
      userName={context.profile?.name ?? undefined}
      email={context.user.email}
    >
      {children}
    </AppShell>
  );
}
