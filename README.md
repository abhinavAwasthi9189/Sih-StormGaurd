# StormGuard AI
Probabilistic thunderstorm and lightning nowcasting prototype (30/60/120/180 min) for Smart India Hackathon 2026, PS 26072.

> Decision-support prototype - **not an official IMD warning**. Replay of archived or simulated data; nothing is live.

## Honesty rule
Every layer carries a tag: `REAL`, `ARCHIVED-REAL` or `SIMULATED`. Tags are written by the pipeline into `manifest.json`;
the UI cannot type them by hand. The committed `web/public/data` is currently **SIMULATED** (a synthetic smoke test) and
its metrics are **not forecast skill**. Real results need a SEVIR run (below); SEVIR results are method validation on US data.

## Run it
```bash
# 1. Pipeline (CPU only, no PyTorch)
pip install -r requirements.txt
python -m pipeline.run_pipeline --synthetic 64        # SIMULATED smoke test, ~1 min
python -m pipeline.export.check_export                # run before every push

# 2. Web
cd web && npm install && npm run dev                  # or: npm run build && npm run preview
```
Real SEVIR data (needs network): `python -m pipeline.fusion.build_cache 30`, then `python -m pipeline.run_pipeline --cache`.
Cache layout: `data/cache/{train,val,calib,test}/*.npz`; the run uses train / calib / test.

## Deploy (Vercel)
Import the repo, set **Root Directory = `web`**, preset Vite, build `npm run build`, output `dist`. No functions, no env vars.

## Static data contract
| Need | Static file |
|---|---|
| Forecast polygons | `/data/events/:event/fc/:scenario/risk_:lead.geojson` |
| Probability raster | `/data/events/:event/fc/:scenario/p:lead.png` |
| Source status | `/data/sources_status.json` |
| Alerts | `/data/events/:event/alerts.json` |
| Metrics | `/data/metrics.json` |
| Replay | client-side clock, no server |

## Known limitations
Map corners are approximate; only four lead times; thresholds come from small calibration sets; the India track
(INSAT/ERA5/IMERG) is not implemented; no basemap tiles (graticule only); SEVIR adapter untested.

## Team
Kalki Coders
