"""Run before every push: python -m pipeline.export.check_export  (Guide 18.2)."""
import json, sys
from pathlib import Path
from ..config import WEB_DATA, SCENARIOS, LEADS, TAGS, ROOT


def main():
    errs = []
    size = sum(f.stat().st_size for f in WEB_DATA.rglob("*") if f.is_file()) / 1e6
    if size >= 40: errs.append(f"data folder {size:.1f} MB >= 40 MB")
    man = json.loads((WEB_DATA / "manifest.json").read_text(encoding="utf-8"))
    if man["mode"] not in ("LIVE", "REPLAY", "DEMO"): errs.append("bad mode")
    if man["mode"] == "LIVE" and not man["build"].get("live_feed"): errs.append("LIVE without live_feed")
    for coll in ("datasets", "layers"):
        for it in man[coll]:
            if it["tag"] not in TAGS: errs.append(f"bad tag {it['tag']}")
    for ev in man["events"]:
        d = WEB_DATA / "events" / ev["id"]
        for f in ["meta.json", "motion.json", "alerts.json"]:
            if not (d / f).exists(): errs.append(f"{ev['id']}: missing {f}")
        if len(list((d / "obs").glob("ir107_*.png"))) != 13 or len(list((d / "obs").glob("lght_*.png"))) != 13:
            errs.append(f"{ev['id']}: need 13+13 obs frames")
        for sc in SCENARIOS:
            for L in LEADS:
                if not (d / "fc" / sc / f"p{L}.png").exists(): errs.append(f"{ev['id']}: missing {sc}/p{L}.png")
                g = d / "fc" / sc / f"risk_{L}.geojson"
                if not g.exists(): errs.append(f"{ev['id']}: missing {sc}/risk_{L}.geojson"); continue
                for ft in json.loads(g.read_text())["features"]:
                    ring = ft["geometry"]["coordinates"][0]
                    if len(ring) < 4 or ring[0] != ring[-1]: errs.append(f"{g}: bad ring")
                    if not 0 <= ft["properties"]["p_max"] <= 1: errs.append(f"{g}: p out of range")
    fs = ROOT / "docs" / "forbidden_strings.txt"
    if fs.exists():
        bad = [s for s in fs.read_text().splitlines() if s.strip()]
        for f in ROOT.rglob("*"):
            if f.is_file() and ".git" not in f.parts and "node_modules" not in f.parts and f != fs and f.suffix in (".md", ".json", ".py", ".ts", ".tsx", ".html", ".css", ".txt"):
                t = f.read_text(errors="ignore").lower()
                errs += [f"forbidden string in {f}" for s in bad if s.lower() in t]
    print(f"data size {size:.2f} MB, events {len(man['events'])}")
    if errs:
        print("\n".join(errs[:40])); sys.exit(1)
    print("export OK")


if __name__ == "__main__":
    main()
