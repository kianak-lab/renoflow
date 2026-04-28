"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 60_000;

type BuildVersionPayload = { version?: string };

function readServerBaseline(): string {
  return (
    process.env.NEXT_PUBLIC_APP_BUILD_VERSION?.trim() || "development"
  );
}

export function PwaUpdateClient() {
  const [visible, setVisible] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);
  const baselineRef = useRef(readServerBaseline());
  const refreshingRef = useRef(false);
  const showBanner = useCallback(() => {
    setVisible(true);
  }, []);

  const fetchRemoteVersion = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`/build-version.json?t=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as BuildVersionPayload;
      return typeof data.version === "string" ? data.version : null;
    } catch {
      return null;
    }
  }, []);

  const pollVersion = useCallback(async () => {
    if (typeof window === "undefined") return;
    const base = baselineRef.current;
    if (base === "development") return;

    const remote = await fetchRemoteVersion();
    if (remote && remote !== base) {
      showBanner();
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        await reg?.update();
      } catch {
        /* ignore */
      }
    }
  }, [fetchRemoteVersion, showBanner]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onFocus = () => void pollVersion();
    const onVis = () => {
      if (document.visibilityState === "visible") void pollVersion();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const pollId = setInterval(() => void pollVersion(), POLL_MS);
    void pollVersion();

    const shouldRegister =
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator &&
      (location.protocol === "https:" || location.hostname === "localhost");

    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };

    let cancelled = false;

    if (shouldRegister) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange,
      );
    }

    const wireRegistration = (reg: ServiceWorkerRegistration) => {
      const trackInstalling = (worker: ServiceWorker | null) => {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state !== "installed") return;
          if (navigator.serviceWorker.controller) {
            if (reg.waiting) waitingRef.current = reg.waiting;
            showBanner();
          } else if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        });
      };

      trackInstalling(reg.installing);
      reg.addEventListener("updatefound", () =>
        trackInstalling(reg.installing),
      );

      if (reg.waiting && navigator.serviceWorker.controller) {
        waitingRef.current = reg.waiting;
        showBanner();
      } else if (reg.waiting && !navigator.serviceWorker.controller) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      void reg.update();
    };

    if (shouldRegister) {
      void (async () => {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
          });
          if (!cancelled) wireRegistration(reg);
        } catch {
          /* offline or blocked */
        }
      })();
    }

    return () => {
      cancelled = true;
      clearInterval(pollId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      if (shouldRegister) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
      }
    };
  }, [pollVersion, showBanner]);

  const onRefresh = useCallback(() => {
    const w = waitingRef.current;
    if (w) {
      refreshingRef.current = true;
      w.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    window.location.reload();
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[2147483647] flex justify-center px-3"
      style={{
        paddingTop: "max(8px, env(safe-area-inset-top, 0px))",
      }}
      role="status"
    >
      <button
        type="button"
        onClick={onRefresh}
        className="max-w-lg rounded-full px-4 py-2 text-center text-[13px] font-medium text-white shadow-md [-webkit-tap-highlight-color:transparent]"
        style={{
          background: "#0f2318",
          border: "0.5px solid rgba(255,255,255,0.2)",
          minHeight: 44,
        }}
      >
        Update available — tap to refresh
      </button>
    </div>
  );
}
