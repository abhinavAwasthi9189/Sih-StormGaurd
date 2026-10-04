import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { getMasks } from "../lib/api";
import ProvenanceTag from "./ProvenanceTag";

export default function DataHealth() {
  const { sources, scenario, eventId, manifest } = useStore();
  const [masks, setMasks] = useState<number[]>([1, 1, 1, 1]);
  useEffect(() => { if (eventId) getMasks(eventId, scenario).then((m) => setMasks(m.masks)).catch(() => undefined); }, [eventId, scenario]);
  if (!sources) return null;
  const order = ["ir069", "ir107", "vil", "lght"];
  return (
    <section className="page">
      <h1>Data health</h1>
      <p className="muted">Mode: <b>{sources.mode}</b> · as of <span className="mono">{sources.as_of_utc}</span> (replay clock). Active model scenario: <b>{scenario}</b>
        {" "}— the pipeline hides feeds by availability mask, not just in the UI.</p>
      <table>
        <thead><tr><th>Source</th><th>Status</th><th>Age</th><th>Provenance</th><th>Origin</th></tr></thead>
        <tbody>
          {sources.sources.map((s) => {
            const i = order.indexOf(s.id), removed = i >= 0 && masks[i] === 0;
            return (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td><span className={`chip ${removed ? "removed" : s.status.toLowerCase()}`}>{removed ? "WHAT-IF REMOVED" : s.status}</span></td>
                <td className="mono">{s.age_s === null ? "—" : `${s.age_s} s`}</td>
                <td><ProvenanceTag tag={s.tag} /></td>
                <td>{s.origin}{(s.status === "UNAVAILABLE" || removed) && <span className="muted small"> — source unavailable: model runs in {scenario} mode</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {manifest && <p className="muted small">Build {manifest.build.git} · model {manifest.build.model} · {manifest.build.utc}</p>}
    </section>
  );
}
