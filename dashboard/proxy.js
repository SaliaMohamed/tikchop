import { NextResponse } from "next/server";

export function proxy(request) {
  const userAgent = request.headers.get("user-agent") || "";
  const isMobile = /android|iphone|ipad|ipod|mobile|opera mini|windows phone/i.test(userAgent);
  const wantsSiteInfo = request.nextUrl.searchParams.get("info") === "1";

  if (isMobile && !wantsSiteInfo) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
