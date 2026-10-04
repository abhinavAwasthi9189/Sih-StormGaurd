import type { AlertFile, Bands, Manifest, Meta, Metrics, Motion, Sources, Templates, Thresholds, Scenario } from "./types";

const j = <T,>(u: string) => fetch(u).then((r) => { if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json() as Promise<T>; });
export const getManifest = () => j<Manifest>("/data/manifest.json");
export const getMeta = (id: string) => j<Meta>(`/data/events/${id}/meta.json`);
export const getRisk = (id: string, sc: string, lead: number) => j<GeoJSON.FeatureCollection>(`/data/events/${id}/fc/${sc}/risk_${lead}.geojson`);
export const getAlerts = (id: string) => j<AlertFile>(`/data/events/${id}/alerts.json`);
export const getMotion = (id: string) => j<Motion>(`/data/events/${id}/motion.json`);
export const getMasks = (id: string, sc: Scenario) => j<{ masks: number[]; sources: string[] }>(`/data/events/${id}/fc/${sc}/meta.json`);
export const getMetrics = () => j<Metrics>("/data/metrics.json");
export const getSources = () => j<Sources>("/data/sources_status.json");
export const getBands = () => j<Bands>("/data/calibration_bands.json");
export const getThresholds = () => j<Thresholds>("/data/thresholds.json");
export const getTemplates = () => j<Templates>("/data/alert_templates.json");

export const frameName = (tMin: number) => (tMin === 0 ? "p00" : `m${String(-tMin).padStart(2, "0")}`);
export const truthName = (tMin: number) => `p${String(tMin).padStart(2, "0")}`;
export const url = (id: string, path: string) => `/data/events/${id}/${path}`;

const cache = new Map<string, Uint8ClampedArray>();
/** Decode an 8-bit gray PNG into a 96*96 array (R channel). */
export async function gray(u: string) {
  if (cache.has(u)) return cache.get(u)!;
  const img = new Image(); img.src = u; await img.decode();
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  const out = new Uint8ClampedArray(img.width * img.height);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4];
  cache.set(u, out); return out;
}
export function cellAt(meta: Meta, lon: number, lat: number) {
  const [W, S, E, N] = meta.bbox;
  const c = Math.floor(((lon - W) / (E - W)) * 96), r = Math.floor(((N - lat) / (N - S)) * 96);
  return c < 0 || r < 0 || c > 95 || r > 95 ? null : { r, c };
}
export function lonLatOf(meta: Meta, r: number, c: number): [number, number] {
  const [W, S, E, N] = meta.bbox;
  return [W + ((c + 0.5) / 96) * (E - W), N - ((r + 0.5) / 96) * (N - S)];
}
export function pAt(arr: Uint8ClampedArray, r: number, c: number) {   // max over 3x3
  let m = 0;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && cc >= 0 && rr < 96 && cc < 96) m = Math.max(m, arr[rr * 96 + cc]);
  }
  return m / 255;
}
