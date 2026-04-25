import { NextResponse, type NextRequest } from "next/server";
import { getRequestOrigin } from "@/lib/request-origin";
import { ONBOARDING_BYPASS_COOKIE, ONBOARDING_BYPASS_VALUE } from "@/lib/onboarding-bypass-cookie";
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

  if (isPublicPath(pathname)) {
    if (pathname.startsWith("/login")) {
      if (await hasSession(request)) {
        return NextResponse.redirect(new URL("/", getRequestOrigin(request)));
      }
    }
    return next;
  }

  const needsAppGate =
    pathname === "/" ||
    pathname.startsWith("/final") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/materials") ||
    pathname.startsWith("/onboarding");
  if (needsAppGate) {
    if (!(await hasSession(request))) {
      const login = new URL("/login", getRequestOrigin(request));
      login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
  }

  if (pathname.startsWith("/final") && (await hasSession(request))) {
    if (request.cookies.get(ONBOARDING_BYPASS_COOKIE)?.value === ONBOARDING_BYPASS_VALUE) {
      return next;
    }
    const gate = new URL("/api/onboarding/gate", request.nextUrl);
    try {
      const gr = await fetch(gate, {
        headers: { cookie: request.headers.get("cookie") ?? "" },
        cache: "no-store",
      });
      if (gr.ok) {
        const j = (await gr.json()) as { toOnboarding?: boolean };
        if (j.toOnboarding) {
          const onb = new URL("/onboarding", getRequestOrigin(request));
          onb.searchParams.set("next", "/final");
          return NextResponse.redirect(onb);
        }
      }
    } catch (e) {
      console.error("[middleware] onboarding gate fetch failed", e);
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
