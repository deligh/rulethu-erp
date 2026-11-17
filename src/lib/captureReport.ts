// Capture the REAL filled report from an embedded report template (the daily /
// monthly desk templates). Robust against caching: it first tries the template's
// own exported builder (window.__getReportHTML), and if that isn't available it
// renders the preview and reads the rendered report DOM (#rO) + the template's
// styles directly — which works with every version of the template, cached or not.

interface TemplateWindow extends Window {
  __getReportHTML?: () => string;
  bR?: () => void;          // daily template render fn
  renderPreview?: () => void; // monthly template render fn
}

export function captureTemplateReport(iframe: HTMLIFrameElement | null, title: string): string | undefined {
  if (!iframe) return undefined;
  try {
    const win = iframe.contentWindow as TemplateWindow | null;
    const doc = iframe.contentDocument;
    if (!win || !doc) return undefined;

    // 1) Clean exported builder (full branded report), if the template exposes it.
    try {
      const h = win.__getReportHTML?.();
      if (h && h.length > 300) return h;
    } catch { /* ignore */ }

    // 2) Fallback: render the preview, then read the report DOM directly.
    try { win.bR?.(); } catch { /* ignore */ }
    try { win.renderPreview?.(); } catch { /* ignore */ }

    const rO = doc.getElementById("rO");
    if (rO && rO.innerHTML.length > 300) {
      const style = doc.querySelector("style")?.textContent ?? "";
      const esc = title.replace(/</g, "&lt;");
      return `<!doctype html><html><head><meta charset="utf-8"><title>${esc}</title><style>${style}
        body{background:#fff;color:#222;font-family:Georgia,'Times New Roman',serif;line-height:1.5;font-size:11px;padding:16px 22px}
        .ab,.rh{display:none!important}
        .tt,svg,.ib,.peer-row,.cal-box,.tiles,.gbox,.chartbox{break-inside:avoid;page-break-inside:avoid}
        @media print{@page{size:A4;margin:9mm}}
      </style></head><body><div class="rp">${rO.innerHTML}</div></body></html>`;
    }
  } catch { /* cross-origin or not ready */ }
  return undefined;
}
