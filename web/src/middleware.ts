import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { COOKIE_NAME, verifySessionCookieValue } from "@/lib/simple-auth";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/api/auth/login")) return true;
  if (pathname.startsWith("/api/auth/logout")) return true;
  if (pathname.startsWith("/auth/callback")) return true;
  if (pathname.startsWith("/client-intake")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const supabaseResponse = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    if (pathname.startsWith("/login")) {
      const hasSession = await verifySessionCookieValue(
        request.cookies.get(COOKIE_NAME)?.value,
      );
      if (hasSession) {
        const redirect = NextResponse.redirect(new URL("/", request.url));
        copyCookies(supabaseResponse, redirect);
        return redirect;
      }
    }
    return supabaseResponse;
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
      const redirect = NextResponse.redirect(login);
      copyCookies(supabaseResponse, redirect);
      return redirect;
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

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
