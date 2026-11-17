"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Tiny client redirect — used by catch-all routes that have no generic tabs,
// so any stray sub-path bounces to the module home.
export default function Redirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(to); }, [to, router]);
  return null;
}
