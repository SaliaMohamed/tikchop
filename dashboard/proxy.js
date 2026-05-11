import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request) {
  let supabaseResponse = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )
    await supabase.auth.getUser()
  }

  const isRoot = request.nextUrl.pathname === "/";
  if (isRoot) {
    const userAgent = request.headers.get("user-agent") || "";
    const isMobile = /android|iphone|ipad|ipod|mobile|opera mini|windows phone/i.test(userAgent);
    const wantsSiteInfo = request.nextUrl.searchParams.get("info") === "1";

    if (isMobile && !wantsSiteInfo) {
      const redirectResp = NextResponse.redirect(new URL("/onboarding", request.url));
      supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectResp.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResp;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
