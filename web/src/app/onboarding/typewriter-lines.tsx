"use client";

import { useEffect, useState } from "react";

type Props = {
  line1: string;
  line2: string;
  speedMs?: number;
  onComplete: () => void;
  className1?: string;
  className2?: string;
};

/**
 * Typewriter for title (line1) then subtitle (line2), then onComplete.
 */
export function TypewriterLines({
  line1,
  line2,
  speedMs = 22,
  onComplete,
  className1 = "text-2xl font-semibold text-[#222] sm:text-3xl",
  className2 = "text-base text-[#555] sm:text-lg",
}: Props) {
  const [phase, setPhase] = useState<"l1" | "l2" | "done">("l1");
  const [t1, setT1] = useState("");
  const [t2, setT2] = useState("");

  useEffect(() => {
    setPhase("l1");
    setT1("");
    setT2("");
  }, [line1, line2]);

  useEffect(() => {
    if (phase !== "l1") return;
    if (t1.length >= line1.length) {
      setPhase("l2");
      return;
    }
    const t = window.setTimeout(() => {
      setT1(line1.slice(0, t1.length + 1));
    }, speedMs);
    return () => clearTimeout(t);
  }, [line1, phase, t1, speedMs]);

  useEffect(() => {
    if (phase !== "l2") return;
    if (line2.length === 0) {
      setPhase("done");
      onComplete();
      return;
    }
    if (t2.length >= line2.length) {
      setPhase("done");
      onComplete();
      return;
    }
    const t = window.setTimeout(() => {
      setT2(line2.slice(0, t2.length + 1));
    }, speedMs);
    return () => clearTimeout(t);
  }, [line2, onComplete, phase, t2, speedMs]);

  return (
    <div>
      <h1 className={className1}>{t1}</h1>
      {phase !== "l1" || t1.length > 0 ? <p className={`${className2} mt-2 min-h-[1.4em]`}>{t2}</p> : null}
    </div>
  );
}

export function TypewriterOne({
  text,
  speedMs = 20,
  onComplete,
  className = "text-2xl font-semibold text-[#222] sm:text-3xl",
}: {
  text: string;
  speedMs?: number;
  onComplete: () => void;
  className?: string;
}) {
  const [out, setOut] = useState("");

  useEffect(() => {
    setOut("");
  }, [text]);

  useEffect(() => {
    if (out.length >= text.length) {
      onComplete();
      return;
    }
    const t = window.setTimeout(() => {
      setOut(text.slice(0, out.length + 1));
    }, speedMs);
    return () => clearTimeout(t);
  }, [out, text, onComplete, speedMs]);

  return <h1 className={className}>{out}</h1>;
}
