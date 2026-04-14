import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const oauthErr = searchParams.get("error_description") ?? searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      if (isLocal) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      if (forwardedHost) {
        const proto = request.headers.get("x-forwarded-proto") ?? "https";
        return NextResponse.redirect(`${proto}://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    const q = new URLSearchParams({ error: "auth", msg: error.message });
    return NextResponse.redirect(`${origin}/login?${q.toString()}`);
  }

  if (oauthErr) {
    const q = new URLSearchParams({
      error: "auth",
      msg: oauthErr,
    });
    return NextResponse.redirect(`${origin}/login?${q.toString()}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
