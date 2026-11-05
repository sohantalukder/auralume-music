"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    try { window.sessionStorage.removeItem("aura:chunk-reload"); } catch { /* Storage can be unavailable in private contexts. */ }
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => undefined);
      return;
    }
    void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))).catch(() => undefined);
    if ("caches" in window) void window.caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("aura-shell-")).map((key) => window.caches.delete(key)))).catch(() => undefined);
  }, []);
  return null;
}
