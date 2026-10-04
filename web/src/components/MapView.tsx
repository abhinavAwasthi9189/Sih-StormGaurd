import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useStore } from "../state/store";
import { BLANK_PNG, colourize, verification } from "../lib/colormap";
import { frameName, getMotion, getRisk, truthName, url } from "../lib/api";
import { LEADS } from "../lib/alert";
import type { Lead, Level } from "../lib/types";

const LVL: Record<Level, [string, number[], number]> = { LOW: ["#3E6E64", [1, 2], 1.5], MODERATE: ["#C98A2E", [3, 2], 2], HIGH: ["#B1503A", [1, 0], 3] };
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const BG = { dark: "#0F1A30", light: "#EEF0EA" };
export const leadFor = (t: number): Lead => LEADS.find((l) => l >= t) ?? 180;

export default function MapView() {
  const { meta, thr, scenario, lead, tMin, layers, theme, point, set } = useStore();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const tick = useRef(0);
  const effLead = tMin > 0 ? leadFor(tMin) : lead;

  useEffect(() => {
    if (!meta || !el.current) return;
    setReady(false);
    const [W, S, E, N] = meta.bbox;
    const m = new maplibregl.Map({
      container: el.current, attributionControl: { compact: true },
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": BG[useStore.getState().theme] } }] },
      bounds: [[W, S], [E, N]], fitBoundsOptions: { padding: 30 },
    });
    map.current = m;
    m.on("load", () => {
      const c = meta.corners, coordinates: [[number, number], [number, number], [number, number], [number, number]] = [c.tl, c.tr, c.br, c.bl];
      const grat: GeoJSON.Feature[] = [];
      for (let x = Math.ceil(W); x <= E; x++) grat.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[x, S], [x, N]] } });
      for (let y = Math.ceil(S); y <= N; y++) grat.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[W, y], [E, y]] } });
      m.addSource("grat", { type: "geojson", data: { type: "FeatureCollection", features: grat } });
      m.addLayer({ id: "grat", type: "line", source: "grat", paint: { "line-color": "#7C8CA8", "line-opacity": 0.25, "line-width": 1 } });
      for (const id of ["ir", "prob", "lght", "verify"]) m.addSource(id, { type: "image", url: BLANK_PNG, coordinates });
      m.addLayer({ id: "ir", type: "raster", source: "ir", paint: { "raster-resampling": "nearest" } });
      m.addLayer({ id: "prob", type: "raster", source: "prob", paint: { "raster-resampling": "linear", "raster-opacity": 0.8 } });
      m.addLayer({ id: "lght", type: "raster", source: "lght", paint: { "raster-resampling": "nearest" } });
      m.addLayer({ id: "verify", type: "raster", source: "verify", paint: { "raster-resampling": "nearest" } });
      m.addSource("risk", { type: "geojson", data: EMPTY });
      m.addSource("motion", { type: "geojson", data: EMPTY });
      for (const lvl of ["LOW", "MODERATE", "HIGH"] as Level[]) {
        const [col, dash, w] = LVL[lvl];
        m.addLayer({ id: `riskfill-${lvl}`, type: "fill", source: "risk", filter: ["==", ["get", "level"], lvl], paint: { "fill-color": col, "fill-opacity": 0.12 } });
        m.addLayer({ id: `risk-${lvl}`, type: "line", source: "risk", filter: ["==", ["get", "level"], lvl], paint: { "line-color": col, "line-width": w, ...(dash[1] ? { "line-dasharray": dash } : {}) } });
      }
      m.addLayer({ id: "motion-l", type: "line", source: "motion", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#3A9BE0", "line-width": 2 } });
      m.addLayer({ id: "motion-p", type: "circle", source: "motion", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 3, "circle-color": "#3A9BE0" } });
      setReady(true);
    });
    m.on("click", (e) => set({ point: { lon: e.lngLat.lng, lat: e.lngLat.lat } }));
    return () => { m.remove(); map.current = null; };
  }, [meta?.id]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setPaintProperty("bg", "background-color", BG[theme]);
  }, [theme, ready]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !meta || !thr) return;
    const my = ++tick.current, id = meta.id, t = thr[String(effLead)];
    const setImg = async (src: string, u: string | null) => {
      const s = m.getSource(src) as maplibregl.ImageSource | undefined; if (!s) return;
      const c = meta.corners;
      s.updateImage({ url: u ?? BLANK_PNG, coordinates: [c.tl, c.tr, c.br, c.bl] });
    };
    (async () => {
      const obs = tMin <= 0;
      const ir = layers.ir && obs ? await colourize(url(id, `obs/ir107_${frameName(tMin)}.png`), "ir") : null;
      const lg = layers.lght && obs ? await colourize(url(id, `obs/lght_${frameName(tMin)}.png`), "lght")
        : layers.truth && !obs ? await colourize(url(id, `truth/lght_${truthName(tMin)}.png`), "lght") : null;
      const pr = layers.prob ? await colourize(url(id, `fc/${scenario}/p${effLead}.png`), "prob", t) : null;
      const ve = layers.truth ? await verification(url(id, `truth/label_${effLead}.png`), url(id, `fc/${scenario}/p${effLead}.png`), t.MODERATE) : null;
      const risk = layers.risk ? await getRisk(id, scenario, effLead) : EMPTY;
      const mo = layers.motion ? await getMotion(id) : null;
      if (my !== tick.current) return;                       // a newer update superseded this one
      await setImg("ir", ir); await setImg("lght", lg); await setImg("prob", pr); await setImg("verify", ve);
      (m.getSource("risk") as maplibregl.GeoJSONSource).setData(risk);
      const feats: GeoJSON.Feature[] = [];
      for (const v of mo?.vectors ?? []) {
        const len = v.kmh * 0.012, b = (v.bearing * Math.PI) / 180, lon2 = v.lon + (Math.sin(b) * len) / Math.cos((v.lat * Math.PI) / 180), lat2 = v.lat + Math.cos(b) * len;
        feats.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[v.lon, v.lat], [lon2, lat2]] } });
        feats.push({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lon2, lat2] } });
      }
      (m.getSource("motion") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: feats });
    })().catch(() => undefined);
  }, [ready, meta?.id, thr, scenario, effLead, tMin, layers]);

  useEffect(() => {
    const m = map.current; if (!m) return;
    marker.current?.remove(); marker.current = null;
    if (point) marker.current = new maplibregl.Marker({ color: "#3A9BE0" }).setLngLat([point.lon, point.lat]).addTo(m);
  }, [point, ready]);

  return <div ref={el} className="map" role="application" aria-label="Lightning risk map" />;
}
