import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ErrorBar, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "../state/store";

const M: [string, string, string][] = [["persistence", "Persistence", "#7C8CA8"], ["optical_flow", "Optical flow", "#C98A2E"], ["light_logreg", "Lightweight ML", "#3A9BE0"]];
const f = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "—" : v.toFixed(d));

export default function EvalView() {
  const { metrics } = useStore();
  const [lead, setLead] = useState("60");
  const [t, setT] = useState(0.2);
  if (!metrics) return null;
  const leads = Object.keys(metrics.skill);
  const bss = leads.map((L) => ({ lead: `+${L}`, ...Object.fromEntries(M.flatMap(([k]) => { const s = metrics.skill[L][k], ci = s.ci90.bss; return [[k, s.point.bss], [k + "_e", ci ? [Math.max(0, (s.point.bss ?? 0) - ci[0]), Math.max(0, ci[2] - (s.point.bss ?? 0))] : [0, 0]]]; })) }));
  const abl = Object.entries(metrics.ablation[lead]).map(([k, v]) => ({ name: k, d: v.d_bss ?? 0 }));
  const diag = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  return (
    <section className="page">
      <h1>Evaluation</h1>
      <div className="banner">{metrics.caption}</div>
      <p><b>{metrics.verdict}</b></p>
      <p className="muted small">{metrics.n_test_events} held-out test events · {metrics.n_train_events} training events · {metrics.thresholds_note}</p>
      <h2>Skill by lead time (90% event-level intervals)</h2>
      <label className="small">Alert threshold for POD / FAR / CSI: <select value={t} onChange={(e) => setT(Number(e.target.value))}>{metrics.metric_thresholds.map((x) => <option key={x} value={x}>{Math.round(x * 100)}%</option>)}</select></label>
      <div className="scroll"><table>
        <thead><tr><th>Lead</th><th>Method</th><th>POD</th><th>FAR</th><th>CSI</th><th>Brier</th><th>BSS [5–95%]</th></tr></thead>
        <tbody>{leads.flatMap((L) => M.map(([k, name]) => { const s = metrics.skill[L][k], c = s.ci90.bss; return (
          <tr key={L + k}><td>+{L}</td><td>{name}</td><td className="mono">{f(s.point[`pod_${t}`])}</td><td className="mono">{f(s.point[`far_${t}`])}</td><td className="mono">{f(s.point[`csi_${t}`])}</td><td className="mono">{f(s.point.brier, 4)}</td>
            <td className="mono">{f(s.point.bss)} {c && <span className="muted">[{f(c[0])}, {f(c[2])}]</span>}</td></tr>); }))}</tbody>
      </table></div>
      <h2>Brier skill score by method</h2>
      <div style={{ height: 260 }}><ResponsiveContainer><BarChart data={bss}><CartesianGrid stroke="var(--border)" /><XAxis dataKey="lead" stroke="var(--muted)" /><YAxis stroke="var(--muted)" /><Tooltip /><Legend />
        {M.map(([k, n, c]) => <Bar key={k} dataKey={k} name={n} fill={c} isAnimationActive={false}><ErrorBar dataKey={k + "_e"} stroke="var(--text)" width={4} /></Bar>)}</BarChart></ResponsiveContainer></div>
      <p className="muted small">Higher is better; below 0 means worse than always predicting the training base rate. Where a baseline wins, it is shown on purpose.</p>
      <h2>Lead for the charts below</h2>
      <div className="seg" role="group" aria-label="Lead">{leads.map((L) => <button key={L} className={lead === L ? "on" : ""} aria-pressed={lead === L} onClick={() => setLead(L)}>+{L}</button>)}</div>
      <h2>Reliability (test set)</h2>
      <div style={{ height: 300 }}><ResponsiveContainer><ScatterChart><CartesianGrid stroke="var(--border)" /><XAxis type="number" dataKey="x" domain={[0, 1]} name="forecast" stroke="var(--muted)" /><YAxis type="number" dataKey="y" domain={[0, 1]} name="observed" stroke="var(--muted)" /><Tooltip /><Legend />
        <Scatter name="Perfect" data={diag} line={{ stroke: "#7C8CA8", strokeDasharray: "4 4" }} fill="none" isAnimationActive={false} />
        {M.map(([k, n, c]) => <Scatter key={k} name={n} data={metrics.reliability[lead][k].map((b) => ({ x: b.p_mean, y: b.obs }))} line={{ stroke: c }} fill={c} isAnimationActive={false} />)}</ScatterChart></ResponsiveContainer></div>
      <h2>Feed-removed ablation (change in BSS vs all feeds, +{lead} min)</h2>
      <div style={{ height: 220 }}><ResponsiveContainer><BarChart data={abl}><CartesianGrid stroke="var(--border)" /><XAxis dataKey="name" stroke="var(--muted)" /><YAxis stroke="var(--muted)" /><Tooltip /><Bar dataKey="d" fill="#3A9BE0" isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
      <ul className="small muted">{metrics.notes.map((n) => <li key={n}>{n}</li>)}</ul>
    </section>
  );
}
