import { createClient } from "@supabase/supabase-js";

export type SupabaseFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

function isNewSupabaseApiKey(key: string) {
  return key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
}

export function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server environment is incomplete.");
  }

  return { url, serviceRoleKey };
}

export function createSupabaseServiceRoleClient() {
  const { url, serviceRoleKey } = getSupabaseServerConfig();

  // New Supabase API keys are opaque API keys, not JWTs. The Supabase JS
  // database client still uses the key as its Bearer fallback, so strip that
  // header and keep the key in `apikey`, where the API gateway expects it.
  const apiKeyOnlyFetch: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.delete("authorization");
    headers.set("apikey", serviceRoleKey);
    return fetch(input, { ...init, headers });
  };

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    ...(isNewSupabaseApiKey(serviceRoleKey)
      ? { global: { fetch: apiKeyOnlyFetch } }
      : {}),
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
    if (!isNewSupabaseApiKey(serviceRoleKey) && attempt < 2) {
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

  throw new Error("Supabase request failed after several attempts.");
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
