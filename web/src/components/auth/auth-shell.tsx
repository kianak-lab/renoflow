import type { ReactNode } from "react";
import { Lora } from "next/font/google";

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

type Props = {
  children: ReactNode;
};

export default function AuthShell({ children }: Props) {
  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="w-full bg-[#0f2318] px-4 pb-12 pt-14"
        style={{ borderRadius: 0 }}
      >
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <div
            className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-[#2a5a3a] bg-[#1a3d28]"
            aria-hidden
          >
            <span
              className={`${lora.className} relative text-[1.65rem] font-semibold leading-none text-[#4a9a6a]`}
            >
              R
              <sup className="ml-0.5 text-[0.5em] font-semibold leading-none">
                °
              </sup>
            </span>
          </div>
          <h1
            className={`${lora.className} text-[28px] font-semibold leading-tight tracking-tight`}
          >
            <span className="text-white">Reno</span>
            <span className="text-[#4a9a6a]">Flow</span>
          </h1>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-white/[0.4]">
            Renovation manager
          </p>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/[0.25]">
            Built for contractors
          </p>
        </div>
      </header>
      <main className="flex-1 bg-white">
        <div className="mx-auto max-w-md px-6 py-10">{children}</div>
      </main>
    </div>
  );
}
