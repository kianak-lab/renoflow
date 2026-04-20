import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import LoginForm from "./login-form";
import { COOKIE_NAME, verifySessionCookieValue } from "@/lib/simple-auth";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string; msg?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (await verifySessionCookieValue(token)) redirect("/");

  const params = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center font-serif text-2xl text-emerald-900">RenoFlow</h1>
        <p className="mb-6 text-center text-sm text-zinc-500">Sign in with username and password</p>
        <LoginForm error={params.error} errorMessage={params.msg} />
      </div>
    </div>
  );
}
