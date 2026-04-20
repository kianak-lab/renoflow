import { Suspense } from "react";
import { ClientIntakeForm } from "./client-intake-form";
import "./intake.css";

export const metadata = {
  title: "Client details — RenoFlow",
  description: "Submit your contact information for your contractor",
};

export default function ClientIntakePage() {
  return (
    <Suspense
      fallback={
        <main className="intake-shell">
          <p className="intake-muted">Loading…</p>
        </main>
      }
    >
      <ClientIntakeForm />
    </Suspense>
  );
}
