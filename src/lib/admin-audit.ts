import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";

export async function recordAdminAuditLog(input: {
  actorUserId?: string | null;
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { error } = await createSupabaseServiceRoleClient()
      .from("t_admin_audit_log")
      .insert({
        actor_user_id: input.actorUserId ?? null,
        actor_email: input.actorEmail,
        action: input.action,
        target_type: input.targetType ?? null,
        target_id: input.targetId ?? null,
        metadata: input.metadata ?? {},
      });
    if (error) console.error("Failed to record admin audit log:", error.message);
  } catch (error) {
    console.error("Failed to record admin audit log:", error);
  }
}

export async function recordUserLogin(input: {
  userId?: string | null;
  email: string;
}) {
  try {
    const { error } = await createSupabaseServiceRoleClient()
      .from("t_user_login_log")
      .insert({
        user_id: input.userId ?? null,
        email: input.email,
      });
    if (error) console.error("Failed to record user login:", error.message);
  } catch (error) {
    console.error("Failed to record user login:", error);
  }
}
