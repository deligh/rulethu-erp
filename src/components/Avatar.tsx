// Deterministic colored avatar (Jira-style) from a name.

const PALETTE = [
  ["#8270DB", "#fff"], // purple
  ["#0C66E4", "#fff"], // blue
  ["#22A06B", "#fff"], // green
  ["#E56910", "#fff"], // orange
  ["#C9372C", "#fff"], // red
  ["#1D7AFC", "#fff"],
  ["#6554C0", "#fff"],
  ["#227D9B", "#fff"], // teal
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const [bg, fg] = PALETTE[hash(name) % PALETTE.length];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.4 }}
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}
