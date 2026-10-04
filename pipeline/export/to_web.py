"""Writes web/public/data/** (Guide Sections 15, 18). Static artifacts only."""
import json, shutil, subprocess
from datetime import datetime, timezone
import numpy as np
import cv2
from ..config import WEB_DATA, SCENARIOS, LEADS, DISCLAIMER, SRC
from ..fusion.build_dataset import norm_lg
from ..models.calibrate import apply_iso
from .polygons import risk_polygons, px_to_lonlat
from .motion import motion_vectors
from .alerts import TEMPLATES, build_alerts


def wj(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def png(path, a):
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), np.clip(np.round(a), 0, 255).astype("uint8"))


def frame_name(k):                                  # k=0..12 ; 12 = now
    m = (12 - k) * 5
    return "p00" if m == 0 else f"m{m:02d}"


def git_sha():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL).decode().strip()
    except Exception:
        return "nogit"


def export_event(ev, cal_maps, raw_masks, thr, bands, tag, dataset):
    """cal_maps: {scenario: (4,96,96) calibrated}. ev has x_in,y,truth_lg,meta."""
    d = WEB_DATA / "events" / ev["id"]
    if d.exists():
        shutil.rmtree(d)
    c = ev["meta"]["corners"]
    x = ev["x_in"].astype("float32")
    for k in range(13):
        png(d / "obs" / f"ir107_{frame_name(k)}.png", x[1][..., k] * 255)
        png(d / "obs" / f"lght_{frame_name(k)}.png", x[3][..., k] * 255)
    truth = ev["truth_lg"].astype("float32")
    for j in range(truth.shape[-1]):
        png(d / "truth" / f"lght_p{(j + 1) * 5:02d}.png", norm_lg(truth[..., j]) * 255)
    for li, L in enumerate(LEADS):
        png(d / "truth" / f"label_{L}.png", ev["y"][li] * 255)
    for sc, maps in cal_maps.items():
        for li, L in enumerate(LEADS):
            png(d / "fc" / sc / f"p{L}.png", maps[li] * 255)
            wj(d / "fc" / sc / f"risk_{L}.geojson", risk_polygons(maps[li], thr[str(L)], c))
        wj(d / "fc" / sc / "meta.json", {"masks": raw_masks[sc].tolist(), "sources": SRC})
    wj(d / "motion.json", motion_vectors(x[1], c))
    lonlat = lambda r, cc: px_to_lonlat(r, cc, c)

    def bands_for(lead, p):
        for b in bands["full"][str(lead)]:
            if b["p_lo"] <= p < b["p_hi"] + 1e-9 and b["lo"] is not None:
                return b["lo"], b["hi"]
        return p, p

    full = {L: (cal_maps["full"][i], lonlat, raw_masks["full"]) for i, L in enumerate(LEADS)}
    wj(d / "alerts.json", {"status": "EXERCISE", "alerts": build_alerts(ev["id"], tag, dataset, full, thr, bands_for)})
    W, S, E, N = ev["meta"]["bbox"]
    wj(d / "meta.json", {**{k: v for k, v in ev["meta"].items()}, "tag": tag, "dataset": dataset,
                         "issue_frame_index": 12, "label_windows_frames": dict(zip(map(str, LEADS), ev["windows"])),
                         "label_note": "+180 min window is edge-clipped at the end of the 4-hour event"})


def export_globals(events_out, thr, bands, metrics, dataset_cfg, tag_by_layer, as_of):
    ds = dataset_cfg
    wj(WEB_DATA / "manifest.json", {
        "schema": 1,
        "build": {"utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "git": git_sha(),
                  "model": "light-logreg-v1", "shipped_model": "light_logreg", "live_feed": False},
        "mode": "REPLAY", "disclaimer": DISCLAIMER,
        "datasets": [{"id": ds["id"], "label": ds["label"], "tag": ds["tag"], "region": ds["region"]}],
        "layers": [{"id": k, "label": v[0], "tag": ds["tag"], "origin": v[1]} for k, v in tag_by_layer.items()],
        "events": events_out})
    status = [{"id": s, "label": l, "status": "OK", "age_s": 0, "tag": ds["tag"], "origin": ds["origin"][s]}
              for s, l in zip(SRC, ["Water vapour", "Cloud-top temp", "Radar", "Lightning"])]
    status.append({"id": "nwp", "label": "NWP environment", "status": "UNAVAILABLE", "age_s": None,
                   "tag": ds["tag"], "origin": "not used in this build"})
    wj(WEB_DATA / "sources_status.json", {"as_of_utc": as_of, "mode": "REPLAY", "sources": status})
    wj(WEB_DATA / "metrics.json", metrics)
    wj(WEB_DATA / "calibration_bands.json", bands)
    wj(WEB_DATA / "thresholds.json", thr)
    wj(WEB_DATA / "alert_templates.json", TEMPLATES)
