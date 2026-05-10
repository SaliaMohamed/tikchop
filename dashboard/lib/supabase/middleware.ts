import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_ROUTES } from "../constants";

export async function updateSession(request: NextRequest) {
  // Create base response
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // Initialize Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Get user data
  const { data: { user } } = await supabase.auth.getUser();
  const emailVerified = user?.identities?.[0]?.identity_data?.email_verified;

  // Helper function for redirection
  const redirect = (path: string): NextResponse => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.redirect(url);
  };

  // Early return conditions to minimize redirects
  const isAuthRoute = pathname.startsWith("/auth/");
  const isProtectedRoute = PROTECTED_ROUTES.some((path) => pathname.startsWith(path));

  // Case 1: Verified users shouldn't access auth routes
  if (user && emailVerified && isAuthRoute) {
    return redirect("/user/dashboard");
  }

  // Case 2: Unverified users should only access confirm-otp
  if (user && !emailVerified) {
    if ((isAuthRoute && pathname !== "/auth/confirm-otp") || isProtectedRoute) {
      return redirect("/auth/confirm-otp");
    }
  }

  // Case 3: Specific handling for confirm-otp page
  if (pathname === "/auth/confirm-otp") {
    if (!user) {
      return redirect("/auth/sign-in");
    }
    if (emailVerified) {
      return redirect("/user/dashboard");
    }
  }

  // Case 4: Unauthenticated users accessing protected routes
  if (!user && isProtectedRoute) {
    // Store intended destination
    response.cookies.set("next_url", pathname, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return redirect("/auth/sign-in");
  }

  return response;
}
