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
    <div className="flex min-h-screen flex-col bg-white">
      <header
        className="w-full rounded-none bg-[#0f2318] px-4 pb-14 pt-16"
        style={{ borderRadius: 0 }}
      >
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <div
            className="mb-6 flex h-[3.5rem] w-[3.5rem] shrink-0 items-center justify-center rounded-xl border border-[#2a5a3a] bg-[#1a3d28]"
            aria-hidden
          >
            <span
              className={`${lora.className} text-[1.7rem] font-semibold leading-none tracking-tight text-[#4a9a6a]`}
            >
              R
              <sup className="ml-px translate-y-[-0.05em] text-[0.52em] font-semibold">
                °
              </sup>
            </span>
          </div>
          <h1
            className={`${lora.className} text-[28px] font-semibold leading-none tracking-tight`}
          >
            <span className="text-white">Reno</span>
            <span className="text-[#4a9a6a]">Flow</span>
          </h1>
          <p className="mt-5 max-w-[22rem] text-[11px] font-medium leading-relaxed tracking-[0.28em] text-[rgba(255,255,255,0.4)]">
            RENOVATION MANAGER
          </p>
          <p className="mt-2.5 max-w-[22rem] text-[9px] font-medium leading-relaxed tracking-[0.24em] text-[rgba(255,255,255,0.25)]">
            BUILT FOR CONTRACTORS
          </p>
        </div>
      </header>
      <main className="w-full flex-1 bg-white">
        <div className="mx-auto w-full max-w-md px-6 py-10">{children}</div>
      </main>
    </div>
  );
}
