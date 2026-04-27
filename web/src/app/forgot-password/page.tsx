import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AuthShell from "@/components/auth/auth-shell";
import ForgotPasswordForm from "./forgot-form";
import { COOKIE_NAME, verifySessionCookieValue } from "@/lib/simple-auth";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (await verifySessionCookieValue(token)) redirect("/");

  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
