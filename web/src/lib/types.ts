export type Tag = "REAL" | "ARCHIVED-REAL" | "SIMULATED";   // the only legal values
export type Scenario = "full" | "no_radar" | "no_lightning" | "no_satellite" | "satellite_only";
export type Level = "LOW" | "MODERATE" | "HIGH";
export type Lead = 30 | 60 | 120 | 180;
export type Lang = "en" | "hi";
export type Kind = "hit" | "miss" | "false_alarm" | "quiet";
export type LonLat = [number, number];
export interface Corners { tl: LonLat; tr: LonLat; bl: LonLat; br: LonLat }
export type Thr = Record<Level, number>;

export interface Manifest {
  schema: number;
  build: { utc: string; git: string; model: string; shipped_model: string; live_feed: boolean };
  mode: "LIVE" | "REPLAY" | "DEMO";
  disclaimer: string;
  datasets: { id: string; label: string; tag: Tag; region: string }[];
  layers: { id: string; label: string; tag: Tag; origin: string }[];
  events: { id: string; dataset: string; title: string; t0_utc: string; kind: Kind; has_alerts: boolean }[];
}
export interface Meta {
  id: string; title: string; tag: Tag; dataset: string; issue_time_utc: string;
  bbox: [number, number, number, number]; corners: Corners; event_type: string;
}
export interface SourceRow { id: string; label: string; status: "OK" | "DELAYED" | "UNAVAILABLE"; age_s: number | null; tag: Tag; origin: string }
export interface Sources { as_of_utc: string; mode: string; sources: SourceRow[] }
export interface Band { p_lo: number; p_hi: number; n: number; obs: number | null; lo: number | null; hi: number | null }
export type Bands = Record<Scenario, Record<string, Band[]>>;
export type Thresholds = Record<string, Thr>;
export interface Templates {
  levels: Record<Level, { en: string; hi: string; icon: string; pattern: string }>;
  level_word: Record<Level, { en: string; hi: string }>;
  headline: Record<Lang, string>; body: Record<Lang, string>; sms: Record<Lang, string>;
  instruction: Record<Lang, string>; no_risk: Record<Lang, string>;
}
export interface PreAlert {
  event_id: string; status: string; tag: Tag; dataset: string; scenario: Scenario; level: Level; lead: Lead;
  p: number; lo: number; hi: number; lat: number; lon: number; place: string;
  headline: Record<Lang, string>; body: Record<Lang, string>; sms: Record<Lang, string>;
}
export interface AlertFile { status: string; alerts: PreAlert[] }
type CI = [number, number, number] | null;
export interface Skill { point: Record<string, number | null>; ci90: Record<string, CI>; delta_vs_persistence?: Record<string, CI> }
export interface Metrics {
  dataset: string; tag: Tag; caption: string; verdict: string; n_test_events: number; n_train_events: number;
  base_rate: Record<string, number>; metric_thresholds: number[]; thresholds_note: string; notes: string[];
  skill: Record<string, Record<string, Skill>>;
  ablation: Record<string, Record<string, { bss: number | null; d_bss: number | null }>>;
  reliability: Record<string, Record<string, { p_mean: number; obs: number; n: number }[]>>;
}
export interface Motion { method: string; vectors: { lon: number; lat: number; kmh: number; bearing: number }[] }
export interface AuditEntry { tUtc: string; eventId: string; level: Level; lead: number; p: number; lo: number; hi: number; scenario: Scenario; tag: Tag; hash: string; type: string }
