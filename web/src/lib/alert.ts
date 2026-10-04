import type { Lang, Level, Lead, Templates, Thr, Band } from "./types";

export const LEADS: Lead[] = [30, 60, 120, 180];
export function levelOf(p: number, thr: Thr): Level | null {
  if (p >= thr.HIGH) return "HIGH"; if (p >= thr.MODERATE) return "MODERATE"; if (p >= thr.LOW) return "LOW"; return null;
}
/** Honest ETA: a window between lead times, never a minute-precise claim. */
export function eta(probs: Record<number, number>, thr: Record<string, Thr>) {
  for (const L of LEADS) {
    const lvl = levelOf(probs[L], thr[String(L)]);
    if (lvl === "MODERATE" || lvl === "HIGH") {
      const prev = LEADS[LEADS.indexOf(L) - 1] ?? 0;
      return { text: prev === 0 ? `within ${L} min` : `between ${prev} and ${L} min`, lead: L, level: lvl };
    }
  }
  return null;
}
export function bandFor(bands: Band[] | undefined, p: number): [number, number] {
  const b = bands?.find((x) => p >= x.p_lo && p < x.p_hi + 1e-9 && x.lo !== null && x.hi !== null);
  return b ? [Math.min(b.lo as number, p), Math.max(b.hi as number, p)] : [p, p];
}
export const fill = (tpl: string, v: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

export function smsSegments(text: string, lang: Lang) {
  const uni = lang === "hi" || /[^\x00-\x7F]/.test(text);
  const single = uni ? 70 : 160, multi = uni ? 67 : 153, n = [...text].length;
  return { chars: n, segments: n <= single ? 1 : Math.ceil(n / multi) };
}
export function buildText(t: Templates, lang: Lang, lvl: Level, lead: number, place: string, p: number, lo: number, hi: number, sources: string) {
  const v = { level: t.level_word[lvl][lang], level_hi: t.level_word[lvl].hi, place, lead, p: Math.round(p * 100), lo: Math.round(lo * 100), hi: Math.round(hi * 100), sources };
  return { headline: fill(t.headline[lang], v), body: fill(t.body[lang], v), sms: fill(t.sms[lang], v), instruction: t.instruction[lang] };
}
