import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { getAlerts } from "../lib/api";
import { readAudit, writeAudit } from "../lib/cap";
import type { AuditEntry, PreAlert } from "../lib/types";
import ProvenanceTag from "./ProvenanceTag";

const ist = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium", hour12: false }).format(new Date(iso));

export default function AlertsLog() {
  const { eventId, lang } = useStore();
  const [pre, setPre] = useState<PreAlert[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  useEffect(() => { setAudit(readAudit()); if (eventId) getAlerts(eventId).then((a) => setPre(a.alerts)).catch(() => setPre([])); }, [eventId]);
  return (
    <section className="page">
      <h1>Alerts log</h1>
      <p className="muted">Everything here is an <b>EXERCISE</b>. Pre-built alerts come from the pipeline; entries you export in this browser are kept locally (key <span className="mono">sg:audit:v1</span>).</p>
      <h2>Pre-built for this event</h2>
      {pre.length === 0 ? <p className="muted">No MODERATE or HIGH risk at the issue time for this event.</p> :
        <div className="scroll"><table><thead><tr><th>Level</th><th>Lead</th><th>P (past-case band)</th><th>Place</th><th>Tag</th><th>Text ({lang})</th></tr></thead>
          <tbody>{pre.map((a, i) => <tr key={i}><td>{a.level}</td><td className="mono">+{a.lead}</td><td className="mono">{Math.round(a.p * 100)}% ({Math.round(a.lo * 100)}–{Math.round(a.hi * 100)}%)</td><td>{a.place}</td><td><ProvenanceTag tag={a.tag} /></td><td lang={lang}>{a.headline[lang]}</td></tr>)}</tbody></table></div>}
      <h2>Exported this session</h2>
      {audit.length === 0 ? <p className="muted">Nothing yet. Click a location on the map, then export or log an alert.</p> :
        <div className="scroll"><table><thead><tr><th>Time (IST)</th><th>UTC</th><th>Level</th><th>Lead</th><th>P (band)</th><th>Scenario</th><th>Tag</th><th>Polygon hash</th><th>Type</th></tr></thead>
          <tbody>{audit.map((a, i) => <tr key={i}><td>{ist(a.tUtc)}</td><td className="mono">{a.tUtc.slice(11, 19)}</td><td>{a.level}</td><td className="mono">+{a.lead}</td><td className="mono">{Math.round(a.p * 100)}% ({Math.round(a.lo * 100)}–{Math.round(a.hi * 100)}%)</td><td>{a.scenario}</td><td><ProvenanceTag tag={a.tag} /></td><td className="mono">{a.hash}</td><td>{a.type}</td></tr>)}</tbody></table></div>}
      {audit.length > 0 && <button className="btn ghost" onClick={() => { writeAudit([]); setAudit([]); }}>Clear log</button>}
    </section>
  );
}
