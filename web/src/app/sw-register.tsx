"use client";

import { useEffect } from "react";

// Registers the service worker on the client. Guards on secure context:
// over plain http (e.g. the raw Tailscale IP) `serviceWorker` registration is
// unavailable, so we skip silently. Over the Tailscale HTTPS MagicDNS name and
// on localhost this runs normally.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    ) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Registration failures are non-fatal — the app still works online.
      });
  }, []);

  return null;
}
