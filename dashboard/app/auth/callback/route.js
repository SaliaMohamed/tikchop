import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

function getSafeNextPath(value) {
  const next = String(value || "/dashboard").trim();
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error") || requestUrl.searchParams.get("error_description");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));
  const redirectUrl = new URL(next, requestUrl.origin);

  if (error) {
    const fallbackUrl = new URL("/onboarding?mode=signin&method=email", requestUrl.origin);
    fallbackUrl.searchParams.set("error", "google");
    return NextResponse.redirect(fallbackUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      const fallbackUrl = new URL("/onboarding?mode=signin&method=email", requestUrl.origin);
      fallbackUrl.searchParams.set("error", "google_session");
      return NextResponse.redirect(fallbackUrl);
    }
  }

  redirectUrl.searchParams.set("oauth", "google");
  return NextResponse.redirect(redirectUrl);
}
