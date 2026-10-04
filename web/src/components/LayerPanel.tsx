import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { gray, lonLatOf, url } from "../lib/api";
import { leadFor } from "./MapView";
import ProvenanceTag from "./ProvenanceTag";

const NAMES: Record<string, string> = { ir: "Cloud-top satellite", lght: "Lightning", risk: "Risk polygons", motion: "Storm motion", prob: "Probability raster", truth: "What actually happened" };
const LAYER_ID: Record<string, string> = { ir: "ir107", lght: "lght", risk: "risk", motion: "motion" };

export default function LayerPanel({ replay }: { replay?: boolean }) {
  const { layers, manifest, meta, scenario, lead, tMin, thr, set } = useStore();
  const [top, setTop] = useState<{ lon: number; lat: number; p: number }[]>([]);
  const effLead = tMin > 0 ? leadFor(tMin) : lead;

  useEffect(() => {
    if (!meta) return;
    gray(url(meta.id, `fc/${scenario}/p${effLead}.png`)).then((a) => {
      const idx = [...a.keys()].sort((x, y) => a[y] - a[x]), picks: number[] = [];
      for (const i of idx) {
        if (a[i] < 13) break;
        const r = Math.floor(i / 96), c = i % 96;
        if (picks.every((j) => Math.hypot(Math.floor(j / 96) - r, (j % 96) - c) > 8)) picks.push(i);
        if (picks.length === 5) break;
      }
      setTop(picks.map((i) => { const [lon, lat] = lonLatOf(meta, Math.floor(i / 96), i % 96); return { lon, lat, p: a[i] / 255 }; }));
    }).catch(() => setTop([]));
  }, [meta?.id, scenario, effLead]);

  const tagOf = (k: string) => manifest?.layers.find((l) => l.id === LAYER_ID[k])?.tag;
  return (
    <aside className="panel layers" aria-label="Layers">
      <h2>Layers</h2>
      {(Object.keys(NAMES) as (keyof typeof layers)[]).filter((k) => replay || k !== "truth" || true).map((k) => (
        <label key={k} className="row">
          <input type="checkbox" checked={layers[k]} onChange={(e) => set({ layers: { ...layers, [k]: e.target.checked } })} />
          <span>{NAMES[k]}</span>{tagOf(k) && <ProvenanceTag tag={tagOf(k)!} />}
        </label>
      ))}
      <h2>Forecast lead</h2>
      <div className="seg" role="group" aria-label="Forecast lead">
        {[30, 60, 120, 180].map((l) => (
          <button key={l} className={lead === l ? "on" : ""} aria-pressed={lead === l} onClick={() => set({ lead: l as 30 | 60 | 120 | 180 })}>+{l}</button>
        ))}
      </div>
      <h2>Pick a location</h2>
      <p className="muted small">Highest-risk cells for +{effLead} min. Keyboard-friendly alternative to clicking the map.</p>
      {top.length === 0 && <p className="muted small">No cell above 5% at this lead.</p>}
      <ul className="plain">
        {top.map((t, i) => (
          <li key={i}><button className="link" onClick={() => set({ point: { lon: t.lon, lat: t.lat } })}>
            {t.lat.toFixed(2)}°N {t.lon.toFixed(2)}°E <span className="mono">{Math.round(t.p * 100)}%</span></button></li>
        ))}
      </ul>
      {thr && <p className="muted small">Thresholds +{effLead}: LOW ≥ {Math.round(thr[String(effLead)].LOW * 100)}%, MODERATE ≥ {Math.round(thr[String(effLead)].MODERATE * 100)}%, HIGH ≥ {Math.round(thr[String(effLead)].HIGH * 100)}% (chosen on calibration data).</p>}
      {layers.truth && (
        <div className="legend small" aria-label="Verification legend">
          <div>■ hit (forecast ≥ MODERATE, flash occurred)</div><div>✕ miss (flash, not forecast)</div><div>○ false alarm (forecast, no flash)</div>
        </div>
      )}
    </aside>
  );
}
