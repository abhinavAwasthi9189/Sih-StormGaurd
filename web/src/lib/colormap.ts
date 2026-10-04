import type { Thr } from "./types";

const cache = new Map<string, string>();
async function load(u: string) { const img = new Image(); img.src = u; await img.decode(); return img; }

/** Gray PNG -> coloured RGBA data URL. "prob" uses level thresholds; "ir" and "lght" use ramps. */
export async function colourize(u: string, mode: "prob" | "ir" | "lght", thr?: Thr) {
  const key = `${u}|${mode}|${thr ? thr.LOW + "," + thr.MODERATE + "," + thr.HIGH : ""}`;
  if (cache.has(key)) return cache.get(key)!;
  const img = await load(u);
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] / 255; let rgba: [number, number, number, number] = [0, 0, 0, 0];
    if (mode === "prob" && thr) {
      if (v >= thr.HIGH) rgba = [177, 80, 58, 170]; else if (v >= thr.MODERATE) rgba = [201, 138, 46, 150]; else if (v >= thr.LOW) rgba = [62, 110, 100, 120];
    } else if (mode === "ir") { const k = 255 - d[i]; rgba = [k, k, k, 120]; }
    else if (mode === "lght") { if (v > 0) rgba = [255, 235, 120, Math.min(255, 80 + v * 400)]; }
    d[i] = rgba[0]; d[i + 1] = rgba[1]; d[i + 2] = rgba[2]; d[i + 3] = rgba[3];
  }
  g.putImageData(im, 0, 0);
  const out = c.toDataURL(); cache.set(key, out); return out;
}

/** Verification glyphs on a 4x upscaled canvas — colour AND shape: hit = filled square, miss = X, false alarm = hollow circle. */
export async function verification(labelUrl: string, probUrl: string, t: number) {
  const key = `ver|${labelUrl}|${probUrl}|${t}`;
  if (cache.has(key)) return cache.get(key)!;
  const [a, b] = await Promise.all([load(labelUrl), load(probUrl)]);
  const rd = (img: HTMLImageElement) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d")!; g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
  const L = rd(a), P = rd(b), n = a.width, S = 4;
  const out = document.createElement("canvas"); out.width = n * S; out.height = n * S;
  const g = out.getContext("2d")!; g.lineWidth = 1;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const lab = L[(r * n + c) * 4] > 127, fc = P[(r * n + c) * 4] / 255 >= t, x = c * S, y = r * S;
    if (lab && fc) { g.fillStyle = "#7FC2B1"; g.fillRect(x, y, S, S); }
    else if (lab && !fc) { g.strokeStyle = "#EE9580"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + S, y + S); g.moveTo(x + S, y); g.lineTo(x, y + S); g.stroke(); }
    else if (!lab && fc) { g.strokeStyle = "#E8B66B"; g.beginPath(); g.arc(x + S / 2, y + S / 2, S / 2 - 0.5, 0, 6.3); g.stroke(); }
  }
  const url = out.toDataURL(); cache.set(key, url); return url;
}
export const BLANK_PNG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
