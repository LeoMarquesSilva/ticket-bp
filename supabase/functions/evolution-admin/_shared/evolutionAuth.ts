import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export async function getBearerClient(req: Request): Promise<{
  error: string | null;
  authUserId: string | null;
  userClient: SupabaseClient | null;
}> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: "Authorization ausente", authUserId: null, userClient: null };
  }
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    return { error: "Sessão inválida", authUserId: null, userClient: null };
  }
  return { error: null, authUserId: user.id, userClient };
}

export async function userHasManageCategories(
  admin: SupabaseClient,
  authUserId: string,
): Promise<boolean> {
  const { data: profile } = await admin
    .from("app_c009c0e4f1_users")
    .select("id, role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!profile) return false;
  const roleStr = String(profile.role ?? "").toLowerCase().trim();
  if (roleStr === "admin") return true;
  const { data: roleRow } = await admin
    .from("app_c009c0e4f1_roles")
    .select("id")
    .eq("key", roleStr)
    .maybeSingle();
  if (!roleRow) return false;
  const { data: perm } = await admin
    .from("app_c009c0e4f1_role_permissions")
    .select("permission_key")
    .eq("role_id", roleRow.id)
    .eq("permission_key", "manage_categories")
    .maybeSingle();
  return !!perm;
}

export async function canInvokeTicketNotify(
  admin: SupabaseClient,
  authUserId: string,
  ticketCreatedBy: string,
): Promise<boolean> {
  const { data: profile } = await admin
    .from("app_c009c0e4f1_users")
    .select("id, role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!profile) return false;
  if (profile.id === ticketCreatedBy) return true;
  const roleStr = String(profile.role ?? "").toLowerCase().trim();
  return ["admin", "support", "lawyer"].includes(roleStr);
}
