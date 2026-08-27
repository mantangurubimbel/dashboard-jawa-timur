import { createClient } from "@supabase/supabase-js";

export type SupabaseFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

export function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server environment belum lengkap.");
  }

  return { url, serviceRoleKey };
}

export function createSupabaseServiceRoleClient() {
  const { url, serviceRoleKey } = getSupabaseServerConfig();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function supabaseRestFetch(
  path: string,
  init: SupabaseFetchInit = {},
) {
  const { url, serviceRoleKey } = getSupabaseServerConfig();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const headers = new Headers(init.headers);
    headers.set("apikey", serviceRoleKey);
    if (attempt < 2) {
      headers.set("authorization", `Bearer ${serviceRoleKey}`);
    } else {
      headers.delete("authorization");
    }

    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      cache: init.cache ?? (init.next?.revalidate ? "force-cache" : "no-store"),
      headers,
    });

    if (response.ok || attempt === 4) {
      return response;
    }

    const body = await response.clone().text();
    if (!body.includes("PGRST303") && !body.includes("JWT issued at future")) {
      return response;
    }

    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }

  throw new Error("Supabase request gagal setelah beberapa percobaan.");
}

export async function supabaseRpcFetch(
  functionName: string,
  body: Record<string, unknown> = {},
  init: SupabaseFetchInit = {},
) {
  return supabaseRestFetch(`rpc/${functionName}`, {
    ...init,
    method: "POST",
    headers: {
      ...init.headers,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
