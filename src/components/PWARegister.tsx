"use client";

import { useEffect } from "react";

// Registers the service worker so the ERP is installable (Add to Home Screen)
// and works offline on tablets/phones. Production only, to avoid dev caching.
export default function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* ignore */ });
    }
  }, []);
  return null;
}
