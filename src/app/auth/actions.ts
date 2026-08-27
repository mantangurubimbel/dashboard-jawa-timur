"use server";

import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=Email%20dan%20password%20wajib%20diisi.");
  }

  const supabase = await createSupabaseAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=Email%20atau%20password%20tidak%20valid.");
  }

  redirect("/executive-summary");
}

export async function signOut() {
  const supabase = await createSupabaseAuthServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePassword(formData: FormData) {
  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect("/change-password?error=Semua%20field%20wajib%20diisi.");
  }

  if (newPassword.length < 8) {
    redirect("/change-password?error=Password%20baru%20minimal%208%20karakter.");
  }

  if (newPassword !== confirmPassword) {
    redirect("/change-password?error=Konfirmasi%20password%20tidak%20sama.");
  }

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.email) {
    redirect("/change-password?error=Akun%20tidak%20memiliki%20email%20yang%20valid.");
  }

  // Verify the current password with an isolated client. Using the session
  // client here can replace the cookies before updateUser() runs in this
  // server action, resulting in an intermittent "session missing" error.
  const verificationClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: verifyError } = await verificationClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyError) {
    redirect("/change-password?error=Password%20lama%20tidak%20sesuai.");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    redirect(`/change-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/login?success=Password%20berhasil%20diubah.%20Silakan%20masuk%20kembali.");
}
