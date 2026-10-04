import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, ErrorBar, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { useStore } from "../state/store";
import { cellAt, gray, getRisk, url } from "../lib/api";
import { LEADS, bandFor, buildText, eta, levelOf, smsSegments } from "../lib/alert";
import { download, hash8, pointInRing, readAudit, toCAP, writeAudit } from "../lib/cap";
import type { Level, Scenario } from "../lib/types";
import ProvenanceTag from "./ProvenanceTag";

const ICON: Record<Level, string> = { LOW: "ⓘ", MODERATE: "▲", HIGH: "⬢" };
const COL: Record<Level, string> = { LOW: "#3E6E64", MODERATE: "#C98A2E", HIGH: "#B1503A" };
const SCEN: [Scenario, string][] = [["full", "All feeds"], ["no_radar", "No radar"], ["no_lightning", "No lightning"], ["no_satellite", "No satellite"], ["satellite_only", "Satellite only"]];
const DROP: Record<string, string> = { no_radar: "radar", no_lightning: "lightning", no_satellite: "satellite", satellite_only: "radar + lightning" };
const SRCN = ["water-vapour satellite", "cloud-top satellite", "radar", "lightning"];

export default function DetailDrawer() {
  const { meta, point, scenario, lang, thr, bands, metrics, templates, manifest, set } = useStore();
  const [probs, setProbs] = useState<Record<number, number> | null>(null);
  const [masks, setMasks] = useState<number[]>([1, 1, 1, 1]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!meta || !point) return;
    const cell = cellAt(meta, point.lon, point.lat);
    if (!cell) { setProbs(null); return; }
    Promise.all(LEADS.map((L) => gray(url(meta.id, `fc/${scenario}/p${L}.png`)))).then((arr) => {
      const out: Record<number, number> = {};
      LEADS.forEach((L, i) => { let m = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r = cell.r + dr, c = cell.c + dc; if (r >= 0 && c >= 0 && r < 96 && c < 96) m = Math.max(m, arr[i][r * 96 + c]); } out[L] = m / 255; });
      setProbs(out);
    });
    fetch(url(meta.id, `fc/${scenario}/meta.json`)).then((r) => r.json()).then((j) => setMasks(j.masks)).catch(() => undefined);
  }, [meta?.id, point, scenario]);

  const calc = useMemo(() => {
    if (!probs || !thr || !bands) return null;
    const rows = LEADS.map((L) => { const p = probs[L], [lo, hi] = bandFor(bands[scenario]?.[String(L)], p); return { L, p, lo, hi, lvl: levelOf(p, thr[String(L)]) }; });
    return { rows, eta: eta(probs, thr) };
  }, [probs, thr, bands, scenario]);

  if (!point || !meta || !templates || !metrics) return null;
  const cell = cellAt(meta, point.lon, point.lat);
  const place = `${point.lat.toFixed(2)}°N ${point.lon.toFixed(2)}°E`;
  const focus = calc ? (calc.eta ? calc.rows.find((r) => r.L === calc.eta!.lead)! : calc.rows[1]) : null;
  const lvl: Level | null = calc?.eta?.level ?? null;
  const sources = SRCN.filter((_, i) => masks[i]).join(", ") || "no sources";
  const txt = lvl && focus ? buildText(templates, lang, lvl, focus.L, place, focus.p, focus.lo, focus.hi, sources) : null;
  const abl = metrics.ablation[String(focus?.L ?? 60)];
  const why = abl ? Object.entries(abl).filter(([k]) => k !== "full").sort((a, b) => (a[1].d_bss ?? 0) - (b[1].d_bss ?? 0)) : [];

  const record = async (type: string) => {
    if (!txt || !lvl || !focus) return;
    const hash = await hash8(`${meta.id}${point.lon.toFixed(3)}${point.lat.toFixed(3)}${focus.L}`);
    writeAudit([{ tUtc: new Date().toISOString(), eventId: meta.id, level: lvl, lead: focus.L, p: focus.p, lo: focus.lo, hi: focus.hi, scenario, tag: meta.tag, hash, type }, ...readAudit()]);
  };
  const exportCap = async () => {
    if (!txt || !lvl || !focus) return;
    const fc = await getRisk(meta.id, scenario, focus.L);
    const hit = fc.features.filter((f) => f.geometry.type === "Polygon" && pointInRing(point.lon, point.lat, (f.geometry as GeoJSON.Polygon).coordinates[0]))
      .sort((a, b) => ["LOW", "MODERATE", "HIGH"].indexOf(b.properties?.level) - ["LOW", "MODERATE", "HIGH"].indexOf(a.properties?.level))[0];
    const d = 0.05, ring: [number, number][] = hit ? ((hit.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][])
      : [[point.lon - d, point.lat - d], [point.lon + d, point.lat - d], [point.lon + d, point.lat + d], [point.lon - d, point.lat + d], [point.lon - d, point.lat - d]];
    download(`stormguard-exercise-${meta.id}-${focus.L}.json`, toCAP({ eventId: meta.id, lead: focus.L, level: lvl, ring, lang, headline: txt.headline, body: txt.body, instruction: txt.instruction, placeLabel: place, dataset: meta.dataset, tag: meta.tag, model: manifest?.build.model ?? "", scenario, lo: focus.lo, hi: focus.hi }));
    await record("CAP");
    setNote("Exported with status “Exercise” — this file cannot be mistaken for a real alert.");
  };
  const seg = txt ? smsSegments(txt.sms, lang) : null;

  return (
    <aside className="drawer panel" aria-label="Location detail">
      <div className="dhead"><h2>{place}</h2><ProvenanceTag tag={meta.tag} /><button className="btn ghost" onClick={() => set({ point: null })} aria-label="Close detail">Close</button></div>
      {!cell && <p>This point is outside the forecast area.</p>}
      {scenario !== "full" && <div className="banner">WHAT-IF: recomputed from archive with this feed hidden</div>}
      {calc && focus && (<>
        <p className="eta">{calc.eta ? <>Moderate or higher risk <b>{calc.eta.text}</b></> : templates.no_risk[lang]}</p>
        <div style={{ height: 190 }}>
          <ResponsiveContainer>
            <BarChart data={calc.rows.map((r) => ({ name: `+${r.L}`, p: Math.round(r.p * 100), err: [Math.round((r.p - r.lo) * 100), Math.round((r.hi - r.p) * 100)], lvl: r.lvl }))}>
              <XAxis dataKey="name" stroke="var(--muted)" /><YAxis unit="%" domain={[0, 100]} stroke="var(--muted)" width={42} /><Tooltip />
              <Bar dataKey="p" isAnimationActive={false}>
                {calc.rows.map((r) => <Cell key={r.L} fill={r.lvl ? COL[r.lvl] : "#5A6B8C"} />)}
                <ErrorBar dataKey="err" stroke="var(--text)" width={5} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="plain bars">
          {calc.rows.map((r) => (
            <li key={r.L}><span className="mono">+{r.L} min</span> <span className="mono big">{Math.round(r.p * 100)}%</span>
              <span className="muted"> (similar past cases: {Math.round(r.lo * 100)}–{Math.round(r.hi * 100)}%)</span> {r.lvl ? <b style={{ color: `var(--${r.lvl === "HIGH" ? "high" : r.lvl === "MODERATE" ? "mod" : "low"}-text)` }}>{ICON[r.lvl]} {r.lvl}</b> : <span className="muted">below LOW</span>}</li>
          ))}
        </ul>
        <h3>Why we think so</h3>
        <ul className="plain small">
          {why.map(([k, v]) => <li key={k}>Without {DROP[k]}: Brier skill {v.d_bss === null ? "n/a" : (v.d_bss >= 0 ? "+" : "") + v.d_bss.toFixed(3)} on held-out tests (+{focus.L} min)</li>)}
        </ul>
        <p className="muted small">Skill changes measured on archived test events. They describe the model, not what caused this storm.</p>
        <h3>What-if</h3>
        <div className="seg wrap" role="group" aria-label="Feed what-if">
          {SCEN.map(([k, l]) => <button key={k} className={scenario === k ? "on" : ""} aria-pressed={scenario === k} onClick={() => set({ scenario: k })}>{l}</button>)}
        </div>
        <h3>Suggested alert</h3>
        <div className="seg" role="group" aria-label="Language">
          <button className={lang === "en" ? "on" : ""} onClick={() => set({ lang: "en" })}>English</button>
          <button className={lang === "hi" ? "on" : ""} onClick={() => set({ lang: "hi" })}>हिन्दी</button>
        </div>
        {txt ? (<>
          <div className="alertbox" lang={lang}><b>{txt.headline}</b><p>{txt.body}</p></div>
          <div className="sms mono small" lang={lang}>{txt.sms}</div>
          <p className="muted small">{seg?.chars} characters · {seg?.segments} SMS segment{seg && seg.segments > 1 ? "s" : ""}</p>
          <div className="actions">
            <button className="btn" onClick={exportCap}>Export alert (CAP JSON)</button>
            <button className="btn" onClick={async () => { await navigator.clipboard?.writeText(txt.sms).catch(() => undefined); await record("SMS"); setNote("SMS text copied (marked EXERCISE)."); }}>Copy SMS text</button>
            <button className="btn ghost" onClick={async () => { await record("LOG"); setNote("Added to the alerts log."); }}>Add to log</button>
          </div>
        </>) : <p className="muted">{templates.no_risk[lang]}</p>}
        {note && <p className="small" role="status">{note}</p>}
      </>)}
    </aside>
  );
}
