import { NextResponse, type NextRequest } from "next/server";
import { getRequestOrigin } from "@/lib/request-origin";
import { COOKIE_NAME, verifySessionCookieValue } from "@/lib/simple-auth";

async function hasSession(request: NextRequest): Promise<boolean> {
  try {
    return await verifySessionCookieValue(
      request.cookies.get(COOKIE_NAME)?.value,
    );
  } catch (e) {
    console.error("[middleware] session verify failed", e);
    return false;
  }
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
  const { pathname } = request.nextUrl;
  const next = NextResponse.next();

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/final", getRequestOrigin(request)));
  }

  if (isPublicPath(pathname)) {
    if (pathname.startsWith("/login")) {
      if (await hasSession(request)) {
        return redirectTo("/");
      }
    }
    return next;
  }

  const needsAppGate =
    pathname === "/" || pathname.startsWith("/final") || pathname.startsWith("/projects");
  if (needsAppGate) {
    if (!(await hasSession(request))) {
      const login = new URL("/login", getRequestOrigin(request));
      login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
  }

  if (pathname.startsWith("/api/client-intake/link")) {
    if (!(await hasSession(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (
    pathname.startsWith("/api/projects") ||
    pathname.startsWith("/api/rooms") ||
    pathname.startsWith("/api/clients") ||
    pathname.startsWith("/api/invoice")
  ) {
    if (!(await hasSession(request))) {
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
