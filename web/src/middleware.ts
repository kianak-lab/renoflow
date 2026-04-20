import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionCookieValue } from "@/lib/simple-auth";

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/api/auth/login")) return true;
  if (pathname.startsWith("/api/auth/logout")) return true;
  if (pathname.startsWith("/auth/callback")) return true;
  if (pathname.startsWith("/client-intake")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const next = NextResponse.next();

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/final";
    return NextResponse.redirect(url);
  }

  if (isPublicPath(pathname)) {
    if (pathname.startsWith("/login")) {
      const hasSession = await verifySessionCookieValue(
        request.cookies.get(COOKIE_NAME)?.value,
      );
      if (hasSession) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return next;
  }

  const needsAppGate =
    pathname === "/" || pathname.startsWith("/final") || pathname.startsWith("/projects");
  if (needsAppGate) {
    const hasSession = await verifySessionCookieValue(
      request.cookies.get(COOKIE_NAME)?.value,
    );
    if (!hasSession) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
  }

  if (pathname.startsWith("/api/client-intake/link")) {
    const hasSession = await verifySessionCookieValue(
      request.cookies.get(COOKIE_NAME)?.value,
    );
    if (!hasSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (
    pathname.startsWith("/api/projects") ||
    pathname.startsWith("/api/rooms") ||
    pathname.startsWith("/api/clients") ||
    pathname.startsWith("/api/invoice")
  ) {
    const hasSession = await verifySessionCookieValue(
      request.cookies.get(COOKIE_NAME)?.value,
    );
    if (!hasSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return next;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
