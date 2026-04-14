import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string; msg?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const params = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center font-serif text-2xl text-emerald-900">
          RenoFlow
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-500">
          Sign in with your email
        </p>
        <LoginForm error={params.error} errorMessage={params.msg} />
      </div>
    </div>
  );
}
