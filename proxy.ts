import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
  const isFrameworkPath =
    pathname.startsWith("/_next") || pathname === "/favicon.ico";

  if (!user && !isLoginPath && !isFrameworkPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!user || isFrameworkPath) {
    return response;
  }

  const { data: profile } = await supabase
    .from("t_app_user")
    .select("access_revenue_dashboard")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.access_revenue_dashboard) {
    await supabase.auth.signOut();
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "Akun belum memiliki akses ke dashboard revenue.");
    return NextResponse.redirect(url);
  }

  if (isLoginPath) {
    return NextResponse.redirect(new URL("/executive-summary", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
