import type { Lang, Level, Scenario, Tag, AuditEntry } from "./types";

export interface AlertInput {
  eventId: string; lead: number; level: Level; ring: [number, number][]; lang: Lang; headline: string; body: string;
  instruction: string; placeLabel: string; dataset: string; tag: Tag; model: string; scenario: Scenario; lo: number; hi: number;
}
/** CAP-style JSON. status is ALWAYS "Exercise" so nothing exported can pass for a real alert. */
export function toCAP(a: AlertInput) {
  const poly = a.ring.map(([lon, lat]) => `${lat.toFixed(4)},${lon.toFixed(4)}`).join(" ");
  const sent = new Date().toISOString();
  return {
    alert: {
      identifier: `SG-${a.eventId}-${a.lead}-${a.level}-${Date.parse(sent)}`,
      sender: "stormguard-prototype@example.invalid", sent, status: "Exercise", msgType: "Alert", scope: "Private",
      note: "Prototype output. Decision support only. Not an official IMD warning.",
      info: [{
        language: a.lang === "hi" ? "hi-IN" : "en-IN", category: ["Met"], event: "Lightning nowcast (decision support)",
        responseType: ["Prepare"], urgency: a.level === "HIGH" && a.lead <= 60 ? "Expected" : "Future",
        severity: a.level === "HIGH" ? "Severe" : "Moderate", certainty: a.level === "HIGH" ? "Likely" : "Possible",
        effective: sent, expires: new Date(Date.now() + (a.lead + 30) * 60000).toISOString(),
        senderName: "StormGuard AI (prototype)", headline: a.headline, description: a.body, instruction: a.instruction,
        area: { areaDesc: a.placeLabel, polygon: [poly] },
      }],
    },
    provenance: { dataset: a.dataset, tag: a.tag, model: a.model, scenario: a.scenario, bands: [a.lo, a.hi] },
  };
}
export async function hash8(s: string) {
  try {
    const b = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 8);
  } catch { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h >>> 0).toString(16).padStart(8, "0"); }
}
const KEY = "sg:audit:v1";
export function readAudit(): AuditEntry[] { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
export function writeAudit(list: AuditEntry[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage may be blocked */ } }
export function download(name: string, obj: unknown) {
  const u = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u);
}
export function pointInRing(lon: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
