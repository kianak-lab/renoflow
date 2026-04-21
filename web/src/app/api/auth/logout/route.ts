import { NextResponse } from "next/server";
import { getRequestOrigin } from "@/lib/request-origin";
import { COOKIE_NAME } from "@/lib/simple-auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

export async function GET(request: Request) {
  const url = new URL("/login", getRequestOrigin(request));
  const res = NextResponse.redirect(url);
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
