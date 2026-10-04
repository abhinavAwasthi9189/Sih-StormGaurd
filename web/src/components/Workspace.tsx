import MapView from "./MapView";
import LayerPanel from "./LayerPanel";
import TimeSlider from "./TimeSlider";
import DetailDrawer from "./DetailDrawer";
import { useStore } from "../state/store";

export default function Workspace({ replay }: { replay?: boolean }) {
  const meta = useStore((s) => s.meta);
  const point = useStore((s) => s.point);
  if (!meta) return <p className="muted">Loading event…</p>;
  return (
    <div className={`workspace ${replay ? "replay" : ""}`}>
      <div className="mapwrap"><MapView /><LayerPanel replay={replay} /></div>
      <TimeSlider />
      {point && <DetailDrawer />}
      {!point && <p className="muted small hint">Click the map, or choose a location from the list, to see lead-time probabilities and an exercise alert.</p>}
    </div>
  );
}
