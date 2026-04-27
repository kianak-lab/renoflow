import { type NextRequest } from "next/server";
import { runOAuthCallback } from "@/lib/auth/oauth-callback";

export const dynamic = "force-dynamic";

/** Same handler as `/auth/callback` — use either URL in Supabase Auth redirect allow list. */
export async function GET(request: NextRequest) {
  return runOAuthCallback(request);
}
