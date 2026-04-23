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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm rounded-[12px] border border-[var(--bd)] bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-[var(--tx)]">
          RenoFlow
        </h1>
        <p className="mb-6 text-center text-sm text-[var(--tx3)]">Sign in with username and password</p>
        <LoginForm error={params.error} errorMessage={params.msg} />
      </div>
    </div>
  );
}
