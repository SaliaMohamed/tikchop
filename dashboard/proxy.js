import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SELLER_ROUTE_PREFIXES = [
  "/vendeur",
  "/admin",
  "/dashboard",
  "/orders",
  "/messages",
  "/crm",
  "/products",
  "/add-product",
  "/delivery-settings",
  "/whatsapp",
  "/shop-info",
  "/social-sharing",
  "/app",
];

function isSellerRoute(pathname = "") {
  return SELLER_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function proxy(request) {
  if (request.nextUrl.pathname === "/") {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = "/vendeur";
    appUrl.search = "";
    return NextResponse.redirect(appUrl);
  }

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
    const { data } = await supabase.auth.getUser()
    const user = data?.user || null;

    if (!user && isSellerRoute(request.nextUrl.pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/onboarding";
      redirectUrl.search = "?mode=signin&method=phone";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
