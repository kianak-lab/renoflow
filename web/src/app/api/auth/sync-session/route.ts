import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ensureProfileForUser } from "@/lib/auth-profile";
import {
  attachRenoflowSessionToResponse,
  createSessionToken,
  getAuthSecret,
} from "@/lib/simple-auth";

export const dynamic = "force-dynamic";

/**
 * After Supabase email/password (or magic link) establishes a browser session,
 * mint the RenoFlow HttpOnly cookie so existing middleware / APIs keep working.
 */
export async function POST() {
  const secret = getAuthSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Server is not configured (RENOFLOW_AUTH_SECRET)." },
      { status: 500 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anon) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(supabaseUrl, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: "No Supabase session. Sign in again." },
      { status: 401 },
    );
  }

  await ensureProfileForUser(user);
  const token = await createSessionToken(secret, user.id);
  attachRenoflowSessionToResponse(res, token);
  return res;
}
