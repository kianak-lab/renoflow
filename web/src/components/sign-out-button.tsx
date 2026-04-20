"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.refresh();
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="btn bg sm"
    >
      Sign out
    </button>
  );
}
