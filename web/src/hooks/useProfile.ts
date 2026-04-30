"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProfileMeRow } from "@/lib/profile-me-response";
import {
  formatAreaFromSqFt,
  formatLengthFromFt,
  parseMeasurementUnits,
} from "@/lib/measurement-profile";
import { formatMoneyWithCurrency, parseProfileCurrency } from "@/lib/format-money-profile";

export const PROFILE_CACHE_KEY = "rf_profile_cache_v1";

export type ProfileEnvelope = {
  profile: ProfileMeRow;
  tax_percent: number;
  tax_id_label: "BN" | "EIN";
};

function readCache(): ProfileEnvelope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as ProfileEnvelope;
    if (!j?.profile) return null;
    return j;
  } catch {
    return null;
  }
}

function writeCache(env: ProfileEnvelope) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(env));
  } catch {
    /* quota */
  }
}

export function useProfile() {
  const [data, setData] = useState<ProfileEnvelope | null>(() => readCache());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/me", { credentials: "include", cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as ProfileEnvelope & { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Could not load profile");
        return null;
      }
      const env: ProfileEnvelope = {
        profile: j.profile,
        tax_percent: typeof j.tax_percent === "number" ? j.tax_percent : 0,
        tax_id_label: j.tax_id_label === "EIN" ? "EIN" : "BN",
      };
      writeCache(env);
      setData(env);
      return env;
    } catch {
      setError("Network error");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currency = useMemo(
    () => parseProfileCurrency(data?.profile?.currency ?? undefined),
    [data?.profile?.currency],
  );

  const measurementUnits = useMemo(
    () => parseMeasurementUnits(data?.profile?.measurement_units ?? undefined),
    [data?.profile?.measurement_units],
  );

  const formatMoney = useCallback((n: number) => formatMoneyWithCurrency(n, currency), [currency]);

  const formatArea = useCallback(
    (sqft: number) => formatAreaFromSqFt(sqft, measurementUnits),
    [measurementUnits],
  );

  const formatLen = useCallback(
    (ft: number) => formatLengthFromFt(ft, measurementUnits),
    [measurementUnits],
  );

  const greetingFirstName = useMemo(() => {
    const full = String(data?.profile?.full_name ?? "").trim();
    if (!full) return "";
    return full.split(/\s+/)[0] ?? "";
  }, [data?.profile?.full_name]);

  return {
    profile: data?.profile ?? null,
    taxPercent: data?.tax_percent ?? null,
    taxIdLabel: data?.tax_id_label ?? "BN",
    currency,
    measurementUnits,
    formatMoney,
    formatArea,
    formatLen,
    greetingFirstName,
    loading,
    error,
    refresh,
  };
}

export type UseProfileReturn = ReturnType<typeof useProfile>;
