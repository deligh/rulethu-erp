"use client";

import { usePathname } from "next/navigation";

// Re-keys on every route change so page content animates in (see .page-enter).
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
