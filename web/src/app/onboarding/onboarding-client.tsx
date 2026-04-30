"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CANADA_REGIONS,
  US_REGIONS,
  type OnboardingCountry,
} from "@/lib/onboarding-constants";
import { shouldResetOnboardingOnEachVisit } from "@/lib/onboarding-env";
import { DEFAULT_TRADE_IDS, TRADE_GROUPS } from "@/lib/onboarding-trade-groups";

const PRIMARY = "#0f2318";
const SOFT_BG = "#f0faf2";
const TRACK_BG = "#f0f0f0";
const BORDER_INPUT = "#e0e0e0";
const MUTED = "#888888";
const SUBSTEP_LABEL = "#aaaaaa";
const LOGO_MARK_GREEN = "#4a9a6a";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

type MeasurementUnits = "imperial" | "metric";

type Props = { nextHref: string };

function progressPercent(phase: number): number {
  if (phase <= 0) return 0;
  return Math.min(100, (phase / 5) * 100);
}

function MarkLogo() {
  return (
    <div
      className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[18px] shadow-sm"
      style={{ background: PRIMARY }}
      aria-hidden
    >
      <span
        className="font-serif text-[38px] font-normal leading-none tracking-tight"
        style={{ color: LOGO_MARK_GREEN }}
      >
        R<sup className="text-[0.45em] font-normal leading-none">°</sup>
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l5 5 9-11"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function OnboardingClient({ nextHref }: Props) {
  const router = useRouter();

  /** 0 welcome · 1 company · 2 logo · 3 country · 4 trades · 5 done */
  const [phase, setPhase] = useState(0);

  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [taxId, setTaxId] = useState("");

  const [logoData, setLogoData] = useState<string | null>(null);
  const [country, setCountry] = useState<OnboardingCountry | null>(null);
  const [regionCode, setRegionCode] = useState<string | null>(null);
  const [measurementUnits, setMeasurementUnits] = useState<MeasurementUnits>("imperial");

  const [trades, setTrades] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const g of TRADE_GROUPS) {
      for (const t of g.trades) {
        o[t.id] = DEFAULT_TRADE_IDS.has(t.id);
      }
    }
    return o;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shouldResetOnboardingOnEachVisit()) return;
    void fetch("/api/onboarding/reset-incomplete", { method: "POST" }).catch(() => {});
  }, []);

  const regionMeta = useMemo(() => {
    if (!country || !regionCode) return null;
    const list = country === "CA" ? CANADA_REGIONS : US_REGIONS;
    return list.find((r) => r.code === regionCode) ?? null;
  }, [country, regionCode]);

  function pickLogo(f: File | null) {
    setError(null);
    if (!f || !f.type.startsWith("image/")) return;
    if (f.size > MAX_LOGO_BYTES) {
      setError("Logo must be PNG or JPG, max 5MB.");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === "string") setLogoData(r.result);
    };
    r.readAsDataURL(f);
  }

  const toggleTrade = (id: string) => {
    setTrades((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  async function skipToDashboard() {
    try {
      const res = await fetch("/api/onboarding/set-bypass", { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Could not skip. Try signing in again.");
        return;
      }
    } catch {
      setError("Network error. Try again.");
      return;
    }
    router.push(nextHref);
  }

  function skipCompanyStep() {
    if (!companyName.trim()) setCompanyName("My company");
    setPhase(2);
  }

  function skipLogoStep() {
    setPhase(3);
  }

  const submitFinish = useCallback(async (): Promise<boolean> => {
    if (!companyName.trim()) {
      setError("Company name is required.");
      return false;
    }
    if (!country || !regionCode) {
      setError("Select country and province/state.");
      return false;
    }
    setSaving(true);
    setError(null);
    const selected = Object.entries(trades)
      .filter(([, on]) => on)
      .map(([id]) => id);
    const currency = country === "CA" ? "CAD" : "USD";
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          company_logo_data: logoData,
          country,
          region_code: regionCode,
          company_address: address.trim(),
          company_city: city.trim(),
          company_postal: postal.trim(),
          tax_id: taxId.trim(),
          selected_trades: selected,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          measurement_units: measurementUnits,
          currency,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Save failed. Try again.");
        return false;
      }
      return true;
    } catch {
      setError("Network error. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    companyName,
    country,
    regionCode,
    trades,
    logoData,
    address,
    city,
    postal,
    taxId,
    firstName,
    lastName,
    phone,
    measurementUnits,
  ]);

  const onStartBuilding = async () => {
    const ok = await submitFinish();
    if (ok) router.push(nextHref);
  };

  const btnPrimary =
    "w-full rounded-[100px] px-5 py-3.5 text-[15px] font-semibold text-white transition-opacity disabled:opacity-45";
  const btnGhost =
    "rounded-[100px] px-5 py-3 text-sm font-medium transition-colors hover:opacity-80";

  const field =
    "w-full border-[0.5px] bg-white px-[14px] py-3 text-[14px] text-[#111] outline-none transition placeholder:text-[#bbb]";
  const fieldStyle = { borderColor: BORDER_INPUT, borderRadius: 8 } as const;

  const stepLabel = (n: number) => (
    <p
      className="mb-6 text-center uppercase tracking-[0.1em]"
      style={{ fontSize: 11, color: SUBSTEP_LABEL }}
    >
      Step {n} of 5
    </p>
  );

  const pg = progressPercent(phase);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-white text-[#111]">
      {phase > 0 && (
        <div className="relative z-10 w-full shrink-0" style={{ height: 3, background: TRACK_BG }}>
          <div
            className="h-full transition-[width] duration-500 ease-out"
            style={{ width: `${pg}%`, background: PRIMARY }}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        {/* Welcome */}
        {phase === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-6 pb-16 pt-8">
            <MarkLogo />
            <h1 className="mt-10 max-w-sm text-center text-[26px] font-medium leading-tight text-[#111]">
              Welcome to RenoFlow
            </h1>
            <p className="mt-3 max-w-sm text-center text-[14px] leading-relaxed" style={{ color: MUTED }}>
              Let&apos;s set up your contractor profile. Takes less than 2 minutes.
            </p>
            {error && <p className="mt-6 max-w-sm text-center text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPhase(1);
              }}
              className={`${btnPrimary} mx-auto mt-10 max-w-md`}
              style={{ background: PRIMARY }}
            >
              Get Started
            </button>
            <button
              type="button"
              onClick={() => void skipToDashboard()}
              className="mt-6 text-[14px]"
              style={{ color: SUBSTEP_LABEL }}
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Step 1 — Company & you */}
        {phase === 1 && (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="shrink-0 px-5 pb-2 pt-8">
              {stepLabel(1)}
              <h2 className="text-center text-xl font-semibold text-[#111]">Your company</h2>
              <p className="mt-2 text-center text-[14px]" style={{ color: MUTED }}>
                Tell us about your business and yourself.
              </p>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto px-5 pb-6"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="mx-auto flex max-w-lg flex-col gap-3">
                <input
                  className={field}
                  style={fieldStyle}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company name *"
                  aria-label="Company name"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={field}
                    style={fieldStyle}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    aria-label="First name"
                  />
                  <input
                    className={field}
                    style={fieldStyle}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    aria-label="Last name"
                  />
                </div>
                <input
                  className={field}
                  style={fieldStyle}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  type="tel"
                  aria-label="Phone number"
                />
                <input
                  className={field}
                  style={fieldStyle}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Company address"
                  aria-label="Company address"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={field}
                    style={fieldStyle}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    aria-label="City"
                  />
                  <input
                    className={field}
                    style={fieldStyle}
                    value={postal}
                    onChange={(e) => setPostal(e.target.value)}
                    placeholder="Postal / ZIP code"
                    aria-label="Postal code"
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: SUBSTEP_LABEL }}
                  >
                    {country === "CA" ? "BN (optional)" : country === "US" ? "EIN (optional)" : "Tax ID (optional)"}
                  </label>
                  <input
                    className={field}
                    style={fieldStyle}
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder={
                      country === "US"
                        ? "12-3456789"
                        : country === "CA"
                          ? "123456789 RT0001"
                          : "Business number or EIN"
                    }
                    aria-label="Tax ID"
                  />
                  {!country && (
                    <p className="mt-1 text-[12px]" style={{ color: MUTED }}>
                      Canada: BN · United States: EIN
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#f0f0f0] px-5 py-4">
              <button type="button" className={btnGhost} style={{ color: SUBSTEP_LABEL }} onClick={skipCompanyStep}>
                Skip
              </button>
              <button
                type="button"
                disabled={!companyName.trim()}
                className={`${btnPrimary} max-w-[200px] shrink-0`}
                style={{ background: PRIMARY }}
                onClick={() => setPhase(2)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Logo */}
        {phase === 2 && (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="shrink-0 px-5 pb-2 pt-8">
              {stepLabel(2)}
              <h2 className="text-center text-xl font-semibold text-[#111]">Add your logo</h2>
              <p className="mt-2 text-center text-[14px]" style={{ color: MUTED }}>
                Appears on quotes and invoices sent to clients.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              <div className="mx-auto flex max-w-lg flex-col items-center gap-5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex min-h-[140px] w-full max-w-md flex-col items-center justify-center rounded-lg border-[0.5px] border-dashed bg-[#fafafa] px-4 py-8 transition hover:border-[#bbb]"
                  style={{ borderColor: BORDER_INPUT }}
                >
                  <span className="text-2xl">📷</span>
                  <span className="mt-2 text-[14px] font-medium text-[#333]">Tap to upload</span>
                  <span className="mt-1 text-[12px]" style={{ color: MUTED }}>
                    PNG / JPG · max 5MB
                  </span>
                </button>
                {error && <p className="text-center text-sm text-red-600">{error}</p>}
                <div
                  className="w-full max-w-md rounded-lg border-[0.5px] bg-white p-4 shadow-sm"
                  style={{ borderColor: BORDER_INPUT }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: SUBSTEP_LABEL }}>
                    Quote preview
                  </p>
                  <div className="mt-3 flex items-start gap-3 border-b border-[#eee] pb-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f5f5f5] text-[10px] text-[#aaa]"
                      style={{ border: `0.5px solid ${BORDER_INPUT}` }}
                    >
                      {logoData ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoData} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <span>Logo</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-[#111]">
                        {companyName.trim() || "Your company"}
                      </div>
                      <div className="text-[11px] text-[#888]">Estimate · Q-001</div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded bg-[#f0f0f0]" />
                  <div className="mt-2 h-2 w-4/5 rounded bg-[#f5f5f5]" />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#f0f0f0] px-5 py-4">
              <button type="button" className={btnGhost} style={{ color: SUBSTEP_LABEL }} onClick={skipLogoStep}>
                Skip
              </button>
              <button
                type="button"
                className={`${btnPrimary} max-w-[200px]`}
                style={{ background: PRIMARY }}
                onClick={() => setPhase(3)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Country & units */}
        {phase === 3 && (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="shrink-0 px-5 pb-2 pt-8">
              {stepLabel(3)}
              <h2 className="text-center text-xl font-semibold text-[#111]">Where do you work?</h2>
              <p className="mt-2 text-center text-[14px]" style={{ color: MUTED }}>
                Sets your currency and tax defaults automatically.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              <div className="mx-auto flex max-w-lg flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCountry("CA");
                      setRegionCode(null);
                    }}
                    className="rounded-lg border-[0.5px] p-4 text-left transition"
                    style={{
                      borderColor: country === "CA" ? PRIMARY : BORDER_INPUT,
                      background: country === "CA" ? SOFT_BG : "#fff",
                    }}
                  >
                    <div className="text-2xl leading-none">🇨🇦</div>
                    <div className="mt-2 text-[16px] font-semibold">Canada</div>
                    <div className="text-[13px]" style={{ color: MUTED }}>
                      CAD · GST/HST
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCountry("US");
                      setRegionCode(null);
                    }}
                    className="rounded-lg border-[0.5px] p-4 text-left transition"
                    style={{
                      borderColor: country === "US" ? PRIMARY : BORDER_INPUT,
                      background: country === "US" ? SOFT_BG : "#fff",
                    }}
                  >
                    <div className="text-2xl leading-none">🇺🇸</div>
                    <div className="mt-2 text-[16px] font-semibold">United States</div>
                    <div className="text-[13px]" style={{ color: MUTED }}>
                      USD · Sales Tax
                    </div>
                  </button>
                </div>

                {country === "CA" && (
                  <div
                    className="rounded-lg px-3 py-2.5 text-[13px] font-medium leading-snug"
                    style={{ background: SOFT_BG, color: PRIMARY }}
                  >
                    Currency set to CAD · Tax set to HST 13%
                  </div>
                )}
                {country === "US" && (
                  <div
                    className="rounded-lg px-3 py-2.5 text-[13px] font-medium leading-snug"
                    style={{ background: SOFT_BG, color: PRIMARY }}
                  >
                    Currency set to USD · Tax set per state
                  </div>
                )}

                {country && (
                  <div>
                    <label
                      className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: SUBSTEP_LABEL }}
                    >
                      {country === "CA" ? "Province" : "State"}
                    </label>
                    <select
                      className={field}
                      style={fieldStyle}
                      value={regionCode ?? ""}
                      onChange={(e) => setRegionCode(e.target.value || null)}
                      aria-label={country === "CA" ? "Province" : "State"}
                    >
                      <option value="">Select…</option>
                      {(country === "CA" ? CANADA_REGIONS : US_REGIONS).map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.label} ({r.taxLabel})
                        </option>
                      ))}
                    </select>
                    {regionMeta && (
                      <p className="mt-2 text-[12px]" style={{ color: MUTED }}>
                        Quote tax default: {regionMeta.taxLabel}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <p
                    className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: SUBSTEP_LABEL }}
                  >
                    Measurement units
                  </p>
                  <div className="flex rounded-[100px] bg-[#ececec] p-1">
                    <button
                      type="button"
                      className="flex-1 rounded-[100px] py-2.5 text-[13px] font-semibold transition"
                      style={{
                        background: measurementUnits === "imperial" ? PRIMARY : "transparent",
                        color: measurementUnits === "imperial" ? "#fff" : "#444",
                      }}
                      onClick={() => setMeasurementUnits("imperial")}
                    >
                      Imperial (ft, in)
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-[100px] py-2.5 text-[13px] font-semibold transition"
                      style={{
                        background: measurementUnits === "metric" ? PRIMARY : "transparent",
                        color: measurementUnits === "metric" ? "#fff" : "#444",
                      }}
                      onClick={() => setMeasurementUnits("metric")}
                    >
                      Metric (m, cm)
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#f0f0f0] px-5 py-4">
              <button type="button" className={btnGhost} style={{ color: SUBSTEP_LABEL }} onClick={() => setPhase(2)}>
                Back
              </button>
              <button
                type="button"
                disabled={!country || !regionCode}
                className={`${btnPrimary} max-w-[200px]`}
                style={{ background: PRIMARY }}
                onClick={() => setPhase(4)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Trades */}
        {phase === 4 && (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="shrink-0 px-5 pb-2 pt-8">
              {stepLabel(4)}
              <h2 className="text-center text-xl font-semibold text-[#111]">Your trades</h2>
              <p className="mt-2 text-center text-[14px]" style={{ color: MUTED }}>
                Select what you offer. You can change this later.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              <div className="mx-auto max-w-lg">
                {TRADE_GROUPS.map((g) => (
                  <div key={g.category} className="mb-5">
                    <div
                      className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em]"
                      style={{ color: SUBSTEP_LABEL }}
                    >
                      {g.category}
                    </div>
                    <div className="flex flex-col gap-2">
                      {g.trades.map((t) => {
                        const on = !!trades[t.id];
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTrade(t.id)}
                            className="flex w-full items-center gap-3 rounded-lg border-[0.5px] px-3 py-2.5 text-left transition"
                            style={{
                              borderColor: on ? PRIMARY : BORDER_INPUT,
                              background: on ? SOFT_BG : "#fff",
                            }}
                          >
                            <span className="min-w-0 flex-1 text-[13px] font-medium text-[#111]">{t.label}</span>
                            <span
                              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[4px]"
                              style={{
                                background: on ? PRIMARY : "#fff",
                                border: on ? "none" : `0.5px solid ${BORDER_INPUT}`,
                              }}
                              aria-hidden
                            >
                              {on ? <CheckIcon /> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#f0f0f0] px-5 py-4">
              <button type="button" className={btnGhost} style={{ color: SUBSTEP_LABEL }} onClick={() => setPhase(3)}>
                Back
              </button>
              <button
                type="button"
                className={`${btnPrimary} max-w-[200px]`}
                style={{ background: PRIMARY }}
                onClick={() => setPhase(5)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 5 — Done */}
        {phase === 5 && (
          <div className="flex h-full flex-col items-center justify-center px-6 pb-16 pt-8">
            <div
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
              style={{
                background: SOFT_BG,
                border: "1px solid #d4edda",
              }}
              aria-hidden
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12.5l5 5 9-11"
                  stroke={PRIMARY}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p
              className="mt-8 text-center uppercase tracking-[0.1em]"
              style={{ fontSize: 11, color: SUBSTEP_LABEL }}
            >
              Step 5 of 5
            </p>
            <h2 className="mt-2 text-center text-2xl font-medium leading-tight text-[#111]">You&apos;re all set!</h2>
            <p className="mt-3 max-w-sm text-center text-[14px] leading-relaxed" style={{ color: MUTED }}>
              Your contractor profile is ready. Start building your first quote.
            </p>
            {error && <p className="mt-6 max-w-sm text-center text-sm text-red-600">{error}</p>}
            <button
              type="button"
              disabled={saving}
              className={`${btnPrimary} mx-auto mt-10 max-w-md`}
              style={{ background: PRIMARY }}
              onClick={() => void onStartBuilding()}
            >
              {saving ? "Saving…" : "Start Building →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
