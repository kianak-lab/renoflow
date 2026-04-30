"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import {
  CANADA_REGIONS,
  US_REGIONS,
  type OnboardingCountry,
} from "@/lib/onboarding-constants";
import { TRADE_GROUPS } from "@/lib/onboarding-trade-groups";

const PRIMARY = "#0f2318";
const SOFT_BG = "#f0faf2";
const BORDER_INPUT = "#e0e0e0";
const MUTED = "#888888";
const LOGO_MARK_GREEN = "#4a9a6a";
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

function splitFullName(full: string | null | undefined): { first: string; last: string } {
  const s = String(full ?? "").trim();
  if (!s) return { first: "", last: "" };
  const i = s.indexOf(" ");
  if (i === -1) return { first: s, last: "" };
  return { first: s.slice(0, i), last: s.slice(i + 1).trim() };
}

export default function SettingsPage() {
  const { profile, loading, error: loadErr, refresh } = useProfile();

  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [taxId, setTaxId] = useState("");
  const [logoData, setLogoData] = useState<string | null>(null);
  const [country, setCountry] = useState<OnboardingCountry>("CA");
  const [regionCode, setRegionCode] = useState<string>("ON");
  const [measurementUnits, setMeasurementUnits] = useState<"imperial" | "metric">("imperial");
  const [currency, setCurrency] = useState<"CAD" | "USD">("CAD");
  const [tradeSel, setTradeSel] = useState<Record<string, boolean>>({});
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const allTradeIds = useMemo(
    () => TRADE_GROUPS.flatMap((g) => g.trades.map((t) => t.id)),
    [],
  );

  useEffect(() => {
    if (!profile) return;
    const { first, last } = splitFullName(profile.full_name);
    setCompanyName(profile.company_name ?? "");
    setFirstName(first);
    setLastName(last);
    setPhone(profile.company_phone ?? "");
    setAddress(profile.company_address ?? "");
    setCity(profile.company_city ?? "");
    setPostal(profile.company_postal ?? "");
    setTaxId(profile.tax_id ?? "");
    setLogoData(null);
    const c = profile.country === "US" ? "US" : "CA";
    setCountry(c);
    const rc = profile.region_code?.trim();
    setRegionCode(rc || (c === "CA" ? "ON" : "US-OTHER"));
    setMeasurementUnits(profile.measurement_units === "metric" ? "metric" : "imperial");
    setCurrency(profile.currency === "USD" ? "USD" : "CAD");
    const sel = profile.selected_trades ?? [];
    const next: Record<string, boolean> = {};
    if (!sel.length) {
      for (const id of allTradeIds) next[id] = true;
    } else {
      for (const id of allTradeIds) next[id] = sel.includes(id);
    }
    setTradeSel(next);
  }, [profile, allTradeIds]);

  const regionList = country === "CA" ? CANADA_REGIONS : US_REGIONS;

  const pickLogo = useCallback((f: File | null) => {
    setSaveErr(null);
    if (!f || !f.type.startsWith("image/")) return;
    if (f.size > MAX_LOGO_BYTES) {
      setSaveErr("Logo must be PNG or JPG, max 5MB.");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === "string") setLogoData(r.result);
    };
    r.readAsDataURL(f);
  }, []);

  const toggleTrade = useCallback((id: string) => {
    setTradeSel((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const save = useCallback(async () => {
    setSaveErr(null);
    setSaving(true);
    try {
      const selected_trades = allTradeIds.filter((id) => tradeSel[id]);
      const body: Record<string, unknown> = {
        company_name: companyName.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        company_address: address.trim(),
        company_city: city.trim(),
        company_postal: postal.trim(),
        tax_id: taxId.trim(),
        country,
        region_code: regionCode.trim(),
        measurement_units: measurementUnits,
        currency,
        selected_trades,
      };
      if (logoData !== null) body.company_logo_data = logoData;

      const res = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSaveErr(j.error ?? "Could not save.");
        return;
      }
      await refresh();
    } catch {
      setSaveErr("Network error.");
    } finally {
      setSaving(false);
    }
  }, [
    allTradeIds,
    tradeSel,
    companyName,
    firstName,
    lastName,
    phone,
    address,
    city,
    postal,
    taxId,
    country,
    regionCode,
    measurementUnits,
    currency,
    logoData,
    refresh,
  ]);

  const logoPreview = logoData ?? profile?.company_logo_url ?? null;

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: SOFT_BG }}>
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/final" className="text-sm font-semibold" style={{ color: PRIMARY }}>
            ← Back
          </Link>
          <h1 className="text-lg font-semibold" style={{ color: PRIMARY }}>
            Settings
          </h1>
          <span className="w-12" aria-hidden />
        </div>

        {loadErr ? (
          <p className="mb-4 text-sm text-red-700">{loadErr}</p>
        ) : null}

        <div
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: BORDER_INPUT }}
        >
          {loading && !profile ? (
            <p className="text-sm" style={{ color: MUTED }}>
              Loading profile…
            </p>
          ) : (
            <>
              <label className="mb-3 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Company name
              </label>
              <input
                className="mb-4 w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none"
                style={{ borderColor: BORDER_INPUT }}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                    First name
                  </label>
                  <input
                    className="w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none"
                    style={{ borderColor: BORDER_INPUT }}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                    Last name
                  </label>
                  <input
                    className="w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none"
                    style={{ borderColor: BORDER_INPUT }}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <label className="mb-3 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Phone
              </label>
              <input
                className="mb-4 w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none"
                style={{ borderColor: BORDER_INPUT }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <label className="mb-3 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Street address
              </label>
              <input
                className="mb-4 w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none"
                style={{ borderColor: BORDER_INPUT }}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                    City
                  </label>
                  <input
                    className="w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none"
                    style={{ borderColor: BORDER_INPUT }}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                    Postal / ZIP
                  </label>
                  <input
                    className="w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none"
                    style={{ borderColor: BORDER_INPUT }}
                    value={postal}
                    onChange={(e) => setPostal(e.target.value)}
                  />
                </div>
              </div>

              <label className="mb-3 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                {country === "US" ? "EIN" : "Business number (BN)"}
              </label>
              <input
                className="mb-4 w-full rounded-xl border px-3 py-2.5 text-[15px] outline-none"
                style={{ borderColor: BORDER_INPUT }}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
              />

              <label className="mb-3 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Logo
              </label>
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-neutral-50"
                  style={{ borderColor: BORDER_INPUT }}
                >
                  {logoPreview ? (
                    <Image
                      alt="Company logo"
                      src={logoPreview}
                      width={64}
                      height={64}
                      unoptimized
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="font-serif text-xl" style={{ color: LOGO_MARK_GREEN }}>
                      R°
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor: BORDER_INPUT, color: PRIMARY }}
                  onClick={() => fileRef.current?.click()}
                >
                  Upload
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickLogo(e.target.files?.[0] ?? null)}
                />
              </div>

              <label className="mb-3 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Country
              </label>
              <div className="mb-4 flex gap-2">
                {(["CA", "US"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="flex-1 rounded-xl border py-2.5 text-sm font-semibold"
                    style={{
                      borderColor: BORDER_INPUT,
                      background: country === c ? SOFT_BG : "#fff",
                      color: PRIMARY,
                    }}
                    onClick={() => {
                      setCountry(c);
                      setRegionCode(c === "CA" ? "ON" : "US-OTHER");
                      if (c === "CA" && currency === "USD") setCurrency("CAD");
                    }}
                  >
                    {c === "CA" ? "Canada" : "United States"}
                  </button>
                ))}
              </div>

              <label className="mb-3 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Province / state
              </label>
              <select
                className="mb-4 w-full rounded-xl border bg-white px-3 py-2.5 text-[15px] outline-none"
                style={{ borderColor: BORDER_INPUT }}
                value={regionCode}
                onChange={(e) => setRegionCode(e.target.value)}
              >
                {regionList.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label} ({r.taxLabel})
                  </option>
                ))}
              </select>

              <label className="mb-3 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Currency
              </label>
              <select
                className="mb-4 w-full rounded-xl border bg-white px-3 py-2.5 text-[15px] outline-none"
                style={{ borderColor: BORDER_INPUT }}
                value={currency}
                onChange={(e) => setCurrency(e.target.value === "USD" ? "USD" : "CAD")}
              >
                <option value="CAD">CAD $</option>
                <option value="USD">USD $</option>
              </select>

              <label className="mb-3 block text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Measurement units
              </label>
              <div className="mb-6 flex gap-2">
                {(["imperial", "metric"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    className="flex-1 rounded-xl border py-2.5 text-sm font-semibold capitalize"
                    style={{
                      borderColor: BORDER_INPUT,
                      background: measurementUnits === u ? SOFT_BG : "#fff",
                      color: PRIMARY,
                    }}
                    onClick={() => setMeasurementUnits(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>

              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: MUTED }}>
                Trades shown in RenoFlow
              </div>
              <p className="mb-3 text-xs" style={{ color: MUTED }}>
                Leave all selected if you want every trade available.
              </p>
              <div className="mb-6 space-y-4">
                {TRADE_GROUPS.map((g) => (
                  <div key={g.category}>
                    <div className="mb-2 text-xs font-semibold" style={{ color: PRIMARY }}>
                      {g.category}
                    </div>
                    <div className="flex flex-col gap-2">
                      {g.trades.map((t) => (
                        <label key={t.id} className="flex cursor-pointer items-center gap-2 text-[14px]">
                          <input
                            type="checkbox"
                            checked={!!tradeSel[t.id]}
                            onChange={() => toggleTrade(t.id)}
                            className="h-4 w-4 accent-green-700"
                          />
                          <span>{t.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {saveErr ? <p className="mb-3 text-sm text-red-700">{saveErr}</p> : null}

              <button
                type="button"
                disabled={saving}
                className="w-full rounded-xl py-3 text-[15px] font-semibold text-white disabled:opacity-50"
                style={{ background: PRIMARY }}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
