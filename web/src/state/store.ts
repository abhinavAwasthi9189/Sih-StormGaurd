import { create } from "zustand";
import type { Lang, Lead, Manifest, Meta, Metrics, Scenario, Sources, Templates, Thresholds, Bands } from "../lib/types";
import * as api from "../lib/api";

export type Tab = "nowcast" | "health" | "eval" | "replay" | "alerts";
interface Layers { ir: boolean; lght: boolean; risk: boolean; motion: boolean; prob: boolean; truth: boolean }
interface S {
  tab: Tab; eventId: string | null; scenario: Scenario; lead: Lead; tMin: number;
  playing: boolean; speed: 1 | 2 | 4; theme: "dark" | "light"; lang: Lang;
  layers: Layers; point: { lon: number; lat: number } | null;
  manifest: Manifest | null; meta: Meta | null; thr: Thresholds | null; bands: Bands | null;
  metrics: Metrics | null; templates: Templates | null; sources: Sources | null; error: string | null;
  set: (p: Partial<S>) => void;
  init: () => Promise<void>;
  selectEvent: (id: string) => Promise<void>;
}
export const useStore = create<S>((set, get) => ({
  tab: "nowcast", eventId: null, scenario: "full", lead: 60, tMin: 0, playing: false, speed: 1, theme: "dark", lang: "en",
  layers: { ir: true, lght: true, risk: true, motion: true, prob: false, truth: false }, point: null,
  manifest: null, meta: null, thr: null, bands: null, metrics: null, templates: null, sources: null, error: null,
  set: (p) => set(p),
  init: async () => {
    try {
      const [manifest, thr, bands, metrics, templates, sources] = await Promise.all([
        api.getManifest(), api.getThresholds(), api.getBands(), api.getMetrics(), api.getTemplates(), api.getSources()]);
      set({ manifest, thr, bands, metrics, templates, sources });
      if (manifest.events.length) await get().selectEvent(manifest.events[0].id);
    } catch (e) { set({ error: String(e) }); }
  },
  selectEvent: async (id) => {
    const meta = await api.getMeta(id);
    set({ eventId: id, meta, point: null, tMin: 0, playing: false, scenario: "full" });
  },
}));
