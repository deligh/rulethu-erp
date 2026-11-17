"use client";

import { useEffect } from "react";

// During active development we do NOT run a service worker — it caused stale
// pages for users. This component now removes any previously-registered worker
// and clears its caches, so every load comes fresh from the network.
export default function PWARegister() {
  useEffect(() => {
    try {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations?.()
          .then((regs) => regs.forEach((r) => r.unregister()))
          .catch(() => { /* ignore */ });
      }
      if (typeof caches !== "undefined" && caches.keys) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => { /* ignore */ });
      }
    } catch { /* ignore */ }
  }, []);
  return null;
}
