"use client";

import { useEffect, useRef, useState } from "react";

// Animates the numeric part of a formatted string (e.g. "$83.7M", "1,240")
// from 0 up to its value on mount, preserving prefix/suffix/decimals.
export default function CountUp({ value, duration = 850 }: { value: string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const m = value.match(/^(\D*)(-?[\d,]*\.?\d+)(.*)$/);
    if (!m) { setDisplay(value); return; }
    const prefix = m[1], raw = m[2], suffix = m[3];
    const target = parseFloat(raw.replace(/,/g, ""));
    if (!isFinite(target)) { setDisplay(value); return; }
    const decimals = (raw.split(".")[1] || "").length;
    const hadComma = raw.includes(",");
    const fmt = (n: number) => {
      let s = n.toFixed(decimals);
      if (hadComma) s = Number(s).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      return prefix + s + suffix;
    };
    prev.current = value;
    let startT: number | null = null;
    let raf = 0;
    const step = (t: number) => {
      if (startT === null) startT = t;
      const p = Math.min(1, (t - startT) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(fmt(target * eased));
      if (p < 1 && prev.current === value) raf = requestAnimationFrame(step);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display}</>;
}
