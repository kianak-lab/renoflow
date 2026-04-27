import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getRequestOrigin } from "@/lib/request-origin";
import { clearRenoflowSessionOnResponse } from "@/lib/simple-auth";

export const dynamic = "force-dynamic";

async function signOutSupabaseAndRenoflow(res: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url && anon) {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anon, {
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
    await supabase.auth.signOut();
  }
  clearRenoflowSessionOnResponse(res);
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  await signOutSupabaseAndRenoflow(res);
  return res;
}

export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/login", getRequestOrigin(request)));
  await signOutSupabaseAndRenoflow(res);
  return res;
}
