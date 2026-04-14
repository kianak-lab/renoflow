import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="font-serif text-lg text-emerald-900">RenoFlow</span>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-1 flex-col gap-4 px-6 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900">
          You&apos;re signed in
        </h1>
        <p className="text-zinc-600">
          Signed in as{" "}
          <span className="font-mono text-sm">{user.email}</span>
        </p>
        <p className="text-sm text-zinc-500">
          App features will appear here in the next steps.
        </p>
      </main>
    </div>
  );
}
