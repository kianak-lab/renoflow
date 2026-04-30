import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ensureProfileForUser } from "@/lib/auth-profile";
import {
  attachRenoflowSessionToResponse,
  createSessionToken,
  getAuthSecret,
} from "@/lib/simple-auth";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/**
 * Shared OAuth / email-confirm / recovery handler for GET /auth/callback and GET /api/auth/callback.
 */
export async function runOAuthCallback(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const next = safeNextPath(url.searchParams.get("next"));
  const origin = url.origin;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const secret = getAuthSecret();

  const hasOtp = Boolean(token_hash && typeParam);
  if (!code && !hasOtp) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  if (!supabaseUrl || !anon) {
    return NextResponse.redirect(
      new URL(
        "/login?msg=" +
          encodeURIComponent(
            "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).",
          ),
        origin,
      ),
    );
  }

  if (!secret) {
    return NextResponse.redirect(
      new URL(
        "/login?msg=" + encodeURIComponent("RENOFLOW_AUTH_SECRET is not set."),
        origin,
      ),
    );
  }

  const cookieStore = await cookies();
  const redirect = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient(supabaseUrl, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          redirect.cookies.set(name, value, options),
        );
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(
          "/login?error=auth&msg=" + encodeURIComponent(error.message),
          origin,
        ),
      );
    }
  } else if (token_hash && typeParam) {
    const { error } = await supabase.auth.verifyOtp({
      type: typeParam as EmailOtpType,
      token_hash,
    });
    if (error) {
      return NextResponse.redirect(
        new URL(
          "/login?error=auth&msg=" + encodeURIComponent(error.message),
          origin,
        ),
      );
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login?error=auth&msg=" + encodeURIComponent("No user after OAuth."), origin),
    );
  }

  const profile = await ensureProfileForUser(user);
  if (!profile.ok) {
    return NextResponse.redirect(
      new URL(
        "/login?error=auth&msg=" + encodeURIComponent(profile.error),
        origin,
      ),
    );
  }
  const token = await createSessionToken(secret, user.id);
  attachRenoflowSessionToResponse(redirect, token);

  return redirect;
}
