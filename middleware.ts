import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Allow embedding in the dev/preview iframe; keep strict framing in production.
  if (process.env.NODE_ENV === "production") {
    response.headers.set("X-Frame-Options", "DENY");
  }
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-DNS-Prefetch-Control", "on");

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const isVersioned = request.nextUrl.pathname.startsWith("/api/v1/");
    response.headers.set("API-Version", "v1");
    response.headers.set("X-API-Version", "v1");
    response.headers.set("X-API-Versioned-Path", String(isVersioned));
    if (!isVersioned) {
      response.headers.set("Deprecation", "false");
      response.headers.set("Link", "</api/v1>; rel=\"latest-version\"");
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|offline.html).*)"]
};
