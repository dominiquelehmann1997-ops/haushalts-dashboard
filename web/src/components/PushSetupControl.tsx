"use client";

import { useEffect, useState } from "react";

import { subscribePushAction, unsubscribePushAction } from "@/app/actions/push";

type Status = "loading" | "unconfigured" | "unsupported" | "idle" | "subscribed" | "denied";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** URL-safe base64 → Uint8Array for applicationServerKey. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function getInitialStatus(): Status {
  if (!VAPID_PUBLIC_KEY) return "unconfigured";
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !window.isSecureContext
  ) {
    return "unsupported";
  }
  return "loading";
}

export function PushSetupControl() {
  const [status, setStatus] = useState<Status>(getInitialStatus);

  useEffect(() => {
    if (status !== "loading") return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "subscribed" : "idle"))
      .catch(() => setStatus("idle"));
  }, [status]);

  async function enable(personKey: "dome" | "emely") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setStatus("denied");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    });
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await subscribePushAction(personKey, json);
    setStatus("subscribed");
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await unsubscribePushAction(sub.endpoint);
      await sub.unsubscribe();
    }
    setStatus("idle");
  }

  if (status === "loading") return null;
  if (status === "unconfigured")
    return <p className="text-xs text-slate-500">🔔 Push nicht eingerichtet</p>;
  if (status === "unsupported")
    return <p className="text-xs text-slate-500">🔔 Push auf diesem Gerät nicht verfügbar</p>;
  if (status === "denied")
    return <p className="text-xs text-amber-500">🔔 Push abgelehnt — in den Browser-Einstellungen erlauben</p>;
  if (status === "subscribed")
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-emerald-500">🔔 aktiv auf diesem Gerät</span>
        <button onClick={disable} className="underline text-slate-400">deaktivieren</button>
      </div>
    );
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-400">🔔 Auf diesem Handy aktivieren:</span>
      <button onClick={() => enable("dome")} className="underline">Dome</button>
      <button onClick={() => enable("emely")} className="underline">Emely</button>
    </div>
  );
}
