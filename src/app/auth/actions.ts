"use server";

import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=Email%20and%20password%20are%20required.");
  }

  const supabase = await createSupabaseAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=Invalid%20email%20or%20password.");
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
    redirect("/change-password?error=All%20fields%20are%20required.");
  }

  if (newPassword.length < 8) {
    redirect("/change-password?error=New%20password%20must%20be%20at%20least%208%20characters.");
  }

  if (newPassword !== confirmPassword) {
    redirect("/change-password?error=Password%20confirmation%20does%20not%20match.");
  }

  const supabase = await createSupabaseAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.email) {
    redirect("/change-password?error=The%20account%20does%20not%20have%20a%20valid%20email%20address.");
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
    redirect("/change-password?error=The%20current%20password%20is%20incorrect.");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    redirect(`/change-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/login?success=Password%20changed%20successfully.%20Please%20sign%20in%20again.");
}
