import { AppShell } from "@/components/app-shell";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth";
import { redirect } from "next/navigation";

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
  const { data: profile } = user
    ? await supabase
        .from("t_app_user")
        .select("name")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <AppShell
      userName={profile?.name}
      email={user?.email}
    >
      {children}
    </AppShell>
  );
}
