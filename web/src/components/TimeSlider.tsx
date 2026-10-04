import { useEffect } from "react";
import { useStore } from "../state/store";
import { leadFor } from "./MapView";

export default function TimeSlider() {
  const { tMin, playing, speed, set } = useStore();
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => set({ tMin: useStore.getState().tMin >= 180 ? -60 : useStore.getState().tMin + 5 }), 600 / speed);
    return () => clearInterval(id);
  }, [playing, speed]);

  const clamp = (v: number) => Math.max(-60, Math.min(180, v));
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 30 : 5;
    if (e.key === "ArrowRight") { set({ tMin: clamp(tMin + step) }); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { set({ tMin: clamp(tMin - step) }); e.preventDefault(); }
    else if (e.key === "Home") { set({ tMin: -60 }); e.preventDefault(); }
    else if (e.key === "End") { set({ tMin: 180 }); e.preventDefault(); }
    else if (e.key === " ") { set({ playing: !playing }); e.preventDefault(); }
  };
  const label = tMin > 0 ? `Showing +${leadFor(tMin)} min forecast (forecast steps: 30, 60, 120, 180 min)` : tMin === 0 ? "Observed now (issue time)" : `Observed ${tMin} min`;
  return (
    <div className="slider panel">
      <button className="btn" onClick={() => set({ playing: !playing })} aria-label={playing ? "Pause replay" : "Play replay"}>{playing ? "Pause" : "Play"}</button>
      <select aria-label="Replay speed" value={speed} onChange={(e) => set({ speed: Number(e.target.value) as 1 | 2 | 4 })}>
        <option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
      </select>
      <div className="range">
        <input type="range" min={-60} max={180} step={5} value={tMin} onChange={(e) => set({ tMin: Number(e.target.value) })} onKeyDown={onKey} aria-label="Time relative to issue time, minutes" aria-valuetext={label} list="ticks" />
        <datalist id="ticks">{[-60, 0, 30, 60, 120, 180].map((v) => <option key={v} value={v} />)}</datalist>
        <div className="ticks mono small"><span>−60</span><span style={{ left: "25%" }}>0</span><span style={{ left: "37.5%" }}>+30</span><span style={{ left: "50%" }}>+60</span><span style={{ left: "75%" }}>+120</span><span style={{ left: "100%" }}>+180</span></div>
      </div>
      <div aria-live="polite" className="small slabel">{label}</div>
    </div>
  );
}
