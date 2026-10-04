import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { gray, url } from "../lib/api";
import { LEADS } from "../lib/alert";
import Workspace from "./Workspace";
import type { Kind } from "../lib/types";

const KIND: Record<Kind, string> = { hit: "Hit", miss: "Miss", false_alarm: "False alarm", quiet: "Quiet" };

export default function Replay() {
  const { manifest, eventId, scenario, thr, layers, selectEvent, set } = useStore();
  const [score, setScore] = useState<Record<number, { h: number; m: number; f: number }>>({});
  useEffect(() => { if (!layers.truth) set({ layers: { ...layers, truth: true } }); }, []);
  useEffect(() => {
    if (!eventId || !thr) return;
    Promise.all(LEADS.map(async (L) => {
      const [y, p] = await Promise.all([gray(url(eventId, `truth/label_${L}.png`)), gray(url(eventId, `fc/${scenario}/p${L}.png`))]);
      let h = 0, m = 0, f = 0; const t = thr[String(L)].MODERATE * 255;
      for (let i = 0; i < y.length; i++) { const lab = y[i] > 127, fc = p[i] >= t; if (lab && fc) h++; else if (lab) m++; else if (fc) f++; }
      return [L, { h, m, f }] as const;
    })).then((r) => setScore(Object.fromEntries(r)));
  }, [eventId, scenario, thr]);
  return (
    <section className="page wide">
      <h1>Event replay</h1>
      <p className="muted">Forecast issued at the “now” frame versus what actually happened. Hits, misses and false alarms are all shown on purpose.</p>
      <div className="cards" role="list">
        {manifest?.events.map((e) => (
          <button key={e.id} role="listitem" className={`card ${e.id === eventId ? "on" : ""}`} onClick={() => selectEvent(e.id)}>
            <span className={`kind ${e.kind}`}>{KIND[e.kind]}</span><span>{e.title}</span>
          </button>))}
      </div>
      <Workspace replay />
      <h2>Scoreboard (cells at the MODERATE threshold)</h2>
      <table><thead><tr><th>Lead</th><th>Hits</th><th>Misses</th><th>False alarms</th></tr></thead>
        <tbody>{LEADS.map((L) => <tr key={L}><td>+{L}</td><td className="mono">{score[L]?.h ?? "…"}</td><td className="mono">{score[L]?.m ?? "…"}</td><td className="mono">{score[L]?.f ?? "…"}</td></tr>)}</tbody></table>
    </section>
  );
}
