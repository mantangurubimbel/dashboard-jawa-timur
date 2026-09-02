import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ).has(email.toLowerCase());
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isLoginPath = pathname === "/login";
  const isMaintenancePath = pathname === "/maintenance";
  const isFrameworkPath =
    pathname.startsWith("/_next") || pathname === "/favicon.ico";
  const isServerAction =
    request.method === "POST" && request.headers.has("next-action");

  let maintenanceActive = false;
  if (!isFrameworkPath) {
    const { data } = await supabase
      .from("t_dashboard_maintenance")
      .select("is_active")
      .eq("id", 1)
      .maybeSingle();
    maintenanceActive = Boolean(data?.is_active);
  }

  if (!user && !isLoginPath && !isMaintenancePath && !isFrameworkPath) {
    return NextResponse.redirect(
      new URL(maintenanceActive ? "/maintenance" : "/login", request.url),
    );
  }

  if (!user || isFrameworkPath || isMaintenancePath) {
    return response;
  }

  const { data: profile } = await supabase
    .from("t_app_user")
    .select("access_revenue_dashboard")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.access_revenue_dashboard && !isAdminEmail(user.email)) {
    await supabase.auth.signOut();
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "This account does not have access to the Revenue Dashboard.");
    return NextResponse.redirect(url);
  }

  if (isLoginPath) {
    if (maintenanceActive && !isAdminEmail(user.email)) {
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }
    return NextResponse.redirect(new URL("/executive-summary", request.url));
  }

  if (maintenanceActive && !isAdminEmail(user.email) && !isServerAction && !isMaintenancePath) {
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
