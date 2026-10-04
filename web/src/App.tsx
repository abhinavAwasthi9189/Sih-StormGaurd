import { Suspense, lazy, useEffect, useState } from "react";
import { useStore, type Tab } from "./state/store";
import Disclaimer from "./components/Disclaimer";
import ProvenanceTag from "./components/ProvenanceTag";
import Workspace from "./components/Workspace";
import DataHealth from "./components/DataHealth";
import Replay from "./components/Replay";
import AlertsLog from "./components/AlertsLog";

const EvalView = lazy(() => import("./components/EvalView"));
const TABS: [Tab, string][] = [["nowcast", "Nowcast"], ["replay", "Event replay"], ["health", "Data health"], ["eval", "Evaluation"], ["alerts", "Alerts log"]];
const clock = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour12: false, timeStyle: "medium" });

function IstClock() {
  const [t, setT] = useState(() => clock.format(new Date()));
  useEffect(() => { const id = setInterval(() => setT(clock.format(new Date())), 1000); return () => clearInterval(id); }, []);
  return <span className="mono small" aria-label="Current time in IST">{t} IST</span>;
}

/** The LIVE badge refuses to render unless the manifest says a real feed ran. */
function ModeBadge() {
  const m = useStore((s) => s.manifest);
  if (!m) return null;
  if (m.mode === "LIVE" && !m.build.live_feed) return <span className="pill mode">REPLAY</span>;
  return <span className="pill mode">{m.mode}</span>;
}

export default function App() {
  const { tab, theme, manifest, eventId, error, init, selectEvent, set } = useStore();
  useEffect(() => { init(); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const ds = manifest?.datasets[0];

  return (
    <div className="app">
      <header className="top">
        <h1 className="brand">StormGuard AI</h1>
        <ModeBadge />
        {ds && <span className="dataset"><ProvenanceTag tag={ds.tag} /> <span className="small">{ds.label}</span></span>}
        <span className="grow" />
        <IstClock />
        <button className="btn ghost" onClick={() => set({ theme: theme === "dark" ? "light" : "dark" })}>{theme === "dark" ? "Light theme" : "Dark theme"}</button>
      </header>
      <nav className="tabs" aria-label="Screens">
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} aria-current={tab === k ? "page" : undefined} onClick={() => set({ tab: k })}>{l}</button>)}
        {manifest && tab !== "replay" && (
          <label className="evsel small">Event
            <select value={eventId ?? ""} onChange={(e) => selectEvent(e.target.value)}>
              {manifest.events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </label>)}
      </nav>
      <main>
        {error && <div className="banner" role="alert">Could not load data: {error}. Run the pipeline to create web/public/data (see README).</div>}
        {!manifest && !error && <p className="muted pad">Loading…</p>}
        {manifest && tab === "nowcast" && <section className="page wide"><Workspace /></section>}
        {manifest && tab === "replay" && <Replay />}
        {manifest && tab === "health" && <DataHealth />}
        {manifest && tab === "eval" && <Suspense fallback={<p className="muted pad">Loading charts…</p>}><EvalView /></Suspense>}
        {manifest && tab === "alerts" && <AlertsLog />}
      </main>
      <Disclaimer text={manifest?.disclaimer} />
    </div>
  );
}
