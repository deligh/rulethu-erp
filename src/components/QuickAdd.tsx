"use client";

import { useState } from "react";

export interface Field {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select";
  options?: string[];
  placeholder?: string;
  required?: boolean;
  default?: string | number;
  min?: number;
  step?: number;
}

export type Values = Record<string, string>;

// A toggleable inline "add record" form used across every module.
export default function QuickAdd({
  buttonLabel,
  title,
  fields,
  submitLabel = "Add",
  onSubmit,
  columns = 3,
}: {
  buttonLabel: string;
  title: string;
  fields: Field[];
  submitLabel?: string;
  onSubmit: (values: Values) => void;
  columns?: number;
}) {
  const [open, setOpen] = useState(false);

  const initial = () => {
    const v: Values = {};
    for (const f of fields) {
      v[f.key] = f.default !== undefined ? String(f.default) : f.type === "select" && f.options ? f.options[0] : "";
    }
    return v;
  };
  const [values, setValues] = useState<Values>(initial);

  const set = (k: string, val: string) => setValues((p) => ({ ...p, [k]: val }));

  const missing = fields.filter((f) => f.required && !String(values[f.key] ?? "").trim());
  const canSubmit = missing.length === 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(values);
    setValues(initial());
    setOpen(false);
  };

  const inputStyle = { background: "var(--surface-2)", borderColor: "var(--border)" };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white"
        style={{ background: "var(--brand)" }}
      >
        <span className="text-base leading-none">+</span> {buttonLabel}
      </button>
    );
  }

  return (
    <div
      className="rounded-xl border p-5 mb-6"
      style={{ background: "var(--surface)", borderColor: "var(--brand)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold" style={{ color: "var(--text)" }}>{title}</h3>
        <button onClick={() => setOpen(false)} className="text-sm" style={{ color: "var(--text-faint)" }}>✕</button>
      </div>
      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              {f.label}{f.required && <span style={{ color: "var(--neg)" }}> *</span>}
            </span>
            {f.type === "select" ? (
              <select value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle}>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type={f.type ?? "text"}
                value={values[f.key]}
                placeholder={f.placeholder}
                min={f.min}
                step={f.step}
                onChange={(e) => set(f.key, e.target.value)}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${f.type === "number" ? "text-right tabular" : ""}`}
                style={inputStyle}
              />
            )}
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Cancel
        </button>
        <button onClick={submit} disabled={!canSubmit} className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40" style={{ background: "var(--brand)" }}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
