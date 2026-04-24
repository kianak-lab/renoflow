"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ONBOARDING_GREEN,
  ONBOARDING_TRADES,
  type OnboardingCountry,
  CANADA_REGIONS,
  US_REGIONS,
} from "@/lib/onboarding-constants";
import { shouldResetOnboardingOnEachVisit } from "@/lib/onboarding-env";
import { TypewriterLines } from "./typewriter-lines";

const PROG_H = 4;
const C_PAD = 20;
const G = ONBOARDING_GREEN;

type Props = { nextHref: string };

type LabourMode = "hourly" | "per_job";

function RenoFlowMark() {
  return (
    <div
      className="inline-flex h-16 w-16 items-center justify-center rounded-xl text-3xl font-bold text-white shadow-sm"
      style={{ background: G }}
      aria-hidden
    >
      R
    </div>
  );
}

function ScreenEmoji({ emoji }: { emoji: string }) {
  return <div className="text-5xl leading-none sm:text-6xl">{emoji}</div>;
}

export default function OnboardingClient({ nextHref }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [typeDone, setTypeDone] = useState(false);
  const [contentIn, setContentIn] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [logoData, setLogoData] = useState<string | null>(null);
  const [country, setCountry] = useState<OnboardingCountry | null>(null);
  const [regionCode, setRegionCode] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [taxId, setTaxId] = useState("");
  const [trades, setTrades] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const t of ONBOARDING_TRADES) o[t.id] = t.defaultChecked;
    return o;
  });
  const [labourMode, setLabourMode] = useState<LabourMode>("hourly");
  const [labourRate, setLabourRate] = useState("85");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const doneOnce = useRef(false);

  const resetTypewriter = useCallback(() => {
    setTypeDone(false);
    setContentIn(false);
    doneOnce.current = false;
  }, []);

  useEffect(() => {
    resetTypewriter();
  }, [step, resetTypewriter]);

  useEffect(() => {
    if (!typeDone) return;
    const t = window.setTimeout(() => setContentIn(true), 50);
    return () => clearTimeout(t);
  }, [typeDone]);

  useEffect(() => {
    if (!shouldResetOnboardingOnEachVisit()) return;
    void fetch("/api/onboarding/reset-incomplete", { method: "POST" }).catch(() => {});
  }, []);

  const onTypewriterEnd = useCallback(() => {
    if (doneOnce.current) return;
    doneOnce.current = true;
    setTypeDone(true);
  }, []);

  const copy = useMemo(() => {
    const rows: { title: string; sub: string; emoji?: string; stepLabel?: string }[] = [
      {
        title: "Welcome to RenoFlow",
        sub: "Let's set up your account in under 2 minutes.",
        stepLabel: "",
      },
      {
        title: "What's your company name?",
        sub: "This appears on all your quotes and invoices.",
        emoji: "🏢",
        stepLabel: "Step 1 of 8",
      },
      {
        title: "Add your logo",
        sub: "Your logo appears on every quote. You can always add it later.",
        emoji: "🖼",
        stepLabel: "Step 2 of 8",
      },
      {
        title: "Where are you based?",
        sub: "Sets your currency and tax rules automatically.",
        emoji: "🌎",
        stepLabel: "Step 3 of 8",
      },
      {
        title: "Which province or state?",
        sub: "We set the right tax rate on every quote automatically.",
        emoji: "📍",
        stepLabel: "Step 4 of 8",
      },
      {
        title: "Company details",
        sub: "Your address and tax number appear on invoices for compliance.",
        emoji: "📋",
        stepLabel: "Step 5 of 8",
      },
      {
        title: "Which trades do you work with?",
        sub: "Select as many as you need. Change anytime in Settings.",
        emoji: "🔧",
        stepLabel: "Step 6 of 8",
      },
      {
        title: "Default labour rate",
        sub: "Pre-fills your rate on every trade. Adjust per trade anytime.",
        emoji: "💰",
        stepLabel: "Step 7 of 8",
      },
      {
        title: "You are all set.",
        sub: "RenoFlow is ready. Create your first project and start quoting.",
        stepLabel: "",
      },
    ];
    return rows[step] ?? rows[0];
  }, [step]);

  const progressPct = useMemo(() => {
    if (step <= 0) return 0;
    if (step >= 8) return 100;
    return (step / 8) * 100;
  }, [step]);

  const canSkipHeader = step >= 1 && step <= 7;
  const showWelcomeSkip = step === 0;

  function goDashboard() {
    router.push(nextHref);
  }

  function skipForwards() {
    if (step === 1) {
      if (!companyName.trim()) setCompanyName("My company");
    }
    if (step < 7) {
      setStep((s) => s + 1);
      return;
    }
    if (step === 7) {
      void submitFinish();
    }
  }

  function pickLogo(f: File | null) {
    if (!f || !f.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === "string") setLogoData(r.result);
    };
    r.readAsDataURL(f);
  }

  const toggleTrade = (id: string) => {
    setTrades((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const submitFinish = async () => {
    if (!companyName.trim()) {
      setError("Add your company name (go back to step 1) or enter it to finish.");
      return;
    }
    if (!country || !regionCode) {
      setError("Select country and region first.");
      return;
    }
    setSaving(true);
    setError(null);
    const selected = Object.entries(trades)
      .filter(([, on]) => on)
      .map(([id]) => id);
    const rateNum = parseFloat(labourRate.replace(/,/g, "")) || 0;
    const res = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company_name: companyName.trim(),
        company_logo_data: logoData,
        country,
        region_code: regionCode,
        company_address: address,
        company_city: city,
        company_postal: postal,
        tax_id: taxId,
        selected_trades: selected,
        default_labour_mode: labourMode,
        default_labour_rate: rateNum,
      }),
    });
    setSaving(false);
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(j.error ?? "Save failed. Check Supabase and try again.");
      return;
    }
    setStep(8);
  };

  const btnBase =
    "w-full max-w-md rounded-2xl px-5 py-3.5 text-base font-semibold text-white transition-all duration-200 sm:max-w-lg";
  const field =
    "w-full max-w-md rounded-xl border border-[#ddd] bg-white px-4 py-3 text-[#222] outline-none transition sm:max-w-lg focus:border-[#3a8a3a] focus:ring-2 focus:ring-[#3a8a3a33]";

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-white text-[#222]">
      <div
        className="absolute left-0 right-0 top-0"
        style={{ height: PROG_H, background: "#e8e8e8" }}
      >
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%`, background: G }}
        />
      </div>

      {canSkipHeader && (
        <div className="absolute right-4 top-4 z-10 sm:right-6">
          <button
            type="button"
            onClick={skipForwards}
            className="text-sm font-medium text-[#3a8a3a] underline-offset-2 hover:underline"
          >
            Skip
          </button>
        </div>
      )}

      {copy.stepLabel && (
        <div
          className="absolute left-0 right-0 z-[1] text-center text-xs font-semibold tracking-wide text-[#888] sm:text-sm"
          style={{ top: PROG_H + 12 }}
        >
          {copy.stepLabel}
        </div>
      )}

      {/* 180 / 240 / 300 — fixed from viewport top */}
      <div className="absolute left-0 right-0" style={{ top: 180, textAlign: "center" }}>
        {step === 0 ? (
          <RenoFlowMark />
        ) : step === 8 ? (
          <div
            className="inline-flex h-20 w-20 items-center justify-center rounded-full text-4xl text-white shadow-md"
            style={{ background: G }}
            aria-hidden
          >
            ✓
          </div>
        ) : copy.emoji ? (
          <ScreenEmoji emoji={copy.emoji!} />
        ) : null}
      </div>

      <div
        className="absolute left-0 right-0 px-5"
        style={{ top: 240, paddingLeft: C_PAD, paddingRight: C_PAD }}
      >
        <TypewriterLines
          key={step}
          line1={copy.title}
          line2={copy.sub}
          onComplete={onTypewriterEnd}
        />
      </div>

      <div
        className="absolute left-0 right-0 overflow-y-auto"
        style={{
          top: 380,
          bottom: 0,
          paddingLeft: C_PAD,
          paddingRight: C_PAD,
          paddingBottom: 28,
        }}
      >
        <div
          className="mx-auto max-w-lg pb-8 transition-[opacity,transform] duration-300 ease-out"
          style={{
            opacity: contentIn ? 1 : 0,
            transform: contentIn ? "translateY(0)" : "translateY(6px)",
          }}
        >
          {step === 0 && (
            <div className="flex flex-col items-center gap-4 pt-2">
              <button type="button" onClick={() => setStep(1)} className={btnBase} style={{ background: G }}>
                Get Started
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col items-center gap-4">
              <input
                className={field}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name"
                autoFocus
                aria-label="Company name"
              />
              <button
                type="button"
                disabled={!companyName.trim()}
                onClick={() => setStep(2)}
                className={btnBase + (companyName.trim() ? "" : " opacity-50")}
                style={{ background: G }}
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center gap-4">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0] ?? null)} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-40 w-40 max-w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#ccc] text-sm text-[#666] transition hover:border-[#3a8a3a] hover:text-[#3a8a3a]"
              >
                {logoData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoData} alt="Logo" className="h-full w-full rounded-xl object-contain p-1" />
                ) : (
                  <>
                    <span className="text-3xl">📷</span>
                    <span>Tap to upload</span>
                  </>
                )}
              </button>
              <button type="button" onClick={() => setStep(3)} className={btnBase} style={{ background: G }}>
                Continue
              </button>
              <button type="button" onClick={() => setStep(3)} className="text-sm font-medium text-[#3a8a3a]">
                Skip for now
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center gap-3">
              <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:max-w-lg">
                <button
                  type="button"
                  onClick={() => {
                    setCountry("CA");
                    setRegionCode(null);
                  }}
                  className="rounded-2xl border-2 p-5 text-left transition"
                  style={{
                    borderColor: country === "CA" ? G : "#ddd",
                    background: country === "CA" ? "rgba(58,138,58,0.08)" : "#fff",
                  }}
                >
                  <div className="text-2xl">🇨🇦</div>
                  <div className="mt-1 text-lg font-semibold">Canada</div>
                  <div className="text-sm text-[#666]">HST / GST / PST / QST</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCountry("US");
                    setRegionCode(null);
                  }}
                  className="rounded-2xl border-2 p-5 text-left transition"
                  style={{
                    borderColor: country === "US" ? G : "#ddd",
                    background: country === "US" ? "rgba(58,138,58,0.08)" : "#fff",
                  }}
                >
                  <div className="text-2xl">🇺🇸</div>
                  <div className="mt-1 text-lg font-semibold">United States</div>
                  <div className="text-sm text-[#666]">Sales tax by state</div>
                </button>
              </div>
              <button
                type="button"
                disabled={!country}
                onClick={() => setStep(4)}
                className={btnBase + (!country ? " opacity-50" : "")}
                style={{ background: G }}
              >
                Continue
              </button>
            </div>
          )}

          {step === 4 && country && (
            <div className="flex flex-col items-center gap-3">
              <div className="grid w-full max-w-md grid-cols-2 gap-2 sm:max-w-lg">
                {(country === "CA" ? CANADA_REGIONS : US_REGIONS).map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => setRegionCode(r.code)}
                    className="rounded-xl border-2 p-3 text-left text-sm transition"
                    style={{
                      borderColor: regionCode === r.code ? G : "#e0e0e0",
                      background: regionCode === r.code ? "rgba(58,138,58,0.1)" : "#fafafa",
                    }}
                  >
                    <div className="font-semibold leading-tight">{r.label}</div>
                    <div className="text-xs text-[#666]">{r.taxLabel}</div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!regionCode}
                onClick={() => setStep(5)}
                className={btnBase + (!regionCode ? " opacity-50" : "")}
                style={{ background: G }}
              >
                Continue
              </button>
            </div>
          )}

          {step === 5 && (
            <div className="mx-auto flex max-w-md flex-col gap-3 sm:max-w-lg">
              <input className={field} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Company address" />
              <input className={field} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              <input
                className={field}
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
                placeholder={country === "US" ? "ZIP code" : "Postal code"}
              />
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#666]">
                  {country === "US" ? "EIN (optional)" : "Business number (BN)"}
                </label>
                <input
                  className={field}
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder={country === "US" ? "12-3456789" : "123456789 RT0001"}
                />
              </div>
              <button type="button" onClick={() => setStep(6)} className={btnBase} style={{ background: G }}>
                Continue
              </button>
              <button type="button" onClick={() => setStep(6)} className="w-full text-center text-sm font-medium text-[#3a8a3a]">
                Skip for now
              </button>
            </div>
          )}

          {step === 6 && (
            <div className="mx-auto max-h-[48vh] max-w-md overflow-y-auto pr-1 sm:max-w-lg">
              {["Structure", "Mechanical", "Shell", "Finish", "Exterior", "Specialty"].map((g) => (
                <div key={g} className="mb-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#888]">{g}</div>
                  <div className="flex flex-col gap-2">
                    {ONBOARDING_TRADES.filter((t) => t.group === g).map((t) => (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition"
                        style={{
                          borderColor: trades[t.id] ? G : "#e5e5e5",
                          background: trades[t.id] ? "rgba(58,138,58,0.08)" : "#fff",
                        }}
                      >
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-[#3a8a3a]"
                          checked={!!trades[t.id]}
                          onChange={() => toggleTrade(t.id)}
                        />
                        <span className="text-xl leading-none">{t.icon}</span>
                        <span className="font-medium">{t.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setStep(7)} className={btnBase + " mt-2"} style={{ background: G }}>
                Continue
              </button>
            </div>
          )}

          {step === 7 && (
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 sm:max-w-lg">
              <div className="flex w-full max-w-sm rounded-2xl border border-[#ddd] p-1">
                <button
                  type="button"
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition"
                  style={{
                    background: labourMode === "hourly" ? G : "transparent",
                    color: labourMode === "hourly" ? "#fff" : "#444",
                  }}
                  onClick={() => setLabourMode("hourly")}
                >
                  Hourly rate
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition"
                  style={{
                    background: labourMode === "per_job" ? G : "transparent",
                    color: labourMode === "per_job" ? "#fff" : "#444",
                  }}
                  onClick={() => setLabourMode("per_job")}
                >
                  Per job price
                </button>
              </div>
              <div className="flex w-full max-w-sm items-center gap-2">
                <span className="text-lg font-medium text-[#666]">$</span>
                <input
                  className={field + " m-0 flex-1"}
                  inputMode="decimal"
                  value={labourRate}
                  onChange={(e) => setLabourRate(e.target.value)}
                />
                <span className="whitespace-nowrap text-sm text-[#666]">{labourMode === "hourly" ? "/hr" : " flat"}</span>
              </div>
              {error && <p className="w-full text-center text-sm text-red-600">{error}</p>}
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitFinish()}
                className={btnBase}
                style={{ background: G }}
              >
                {saving ? "Saving…" : "Finish setup"}
              </button>
            </div>
          )}

          {step === 8 && (
            <div className="flex flex-col items-center gap-4 pt-4 text-center">
              <button type="button" onClick={goDashboard} className={btnBase} style={{ background: G }}>
                Start building
              </button>
            </div>
          )}
        </div>
      </div>

      {showWelcomeSkip && (
        <div className="absolute bottom-5 right-5 z-20">
          <button type="button" onClick={goDashboard} className="text-xs text-[#aaa] transition hover:text-[#888]">
            Skip to dashboard
          </button>
        </div>
      )}
    </div>
  );
}
