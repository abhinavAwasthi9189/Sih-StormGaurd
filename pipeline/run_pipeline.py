"""End-to-end: events -> train -> calibrate -> evaluate -> export.
  python -m pipeline.run_pipeline --synthetic 64     # SIMULATED smoke test (no downloads)
  python -m pipeline.run_pipeline --cache            # real SEVIR cache from build_cache
"""
import argparse, json
from datetime import datetime, timedelta
import numpy as np
from .config import *
from .fusion.synthetic import make_event
from .models.baselines import persistence, optical_flow
from .models.train_light import train_models
from .models.infer_light import infer
from .models.calibrate import fit_isotonic, apply_iso, reliability_bands
from .eval.metrics import event_stats, aggregate, bootstrap, pick_thresholds
from .export.to_web import export_event, export_globals

METHODS = ["persistence", "optical_flow", "light_logreg"]


def corners_of(box):
    W, S, E, N = box
    return {"tl": [W, N], "tr": [E, N], "bl": [W, S], "br": [E, S]}


def synthetic_events(n):
    rng = np.random.default_rng(0)
    kinds = ["active", "active", "weak", "quiet"]
    evs = []
    base = datetime(2000, 1, 1)
    for i in range(n):
        ev = make_event(1000 + i, kinds[i % 4])
        ev["id"] = f"SYN_{i:04d}"
        ev["meta"] = {"id": ev["id"], "title": f"Synthetic storm {i:02d} ({kinds[i % 4]})", "event_type": "SIMULATED",
                      "corners": corners_of(BOX), "bbox": list(BOX),
                      "issue_time_utc": (base + timedelta(days=i, hours=18)).strftime("%Y-%m-%dT%H:%M:%SZ")}
        evs.append(ev)
    order = rng.permutation(n)
    a, b = int(.55 * n), int(.75 * n)
    return {"train": [evs[i] for i in order[:a]], "calib": [evs[i] for i in order[a:b]], "test": [evs[i] for i in order[b:]]}


def cache_events():
    out = {"train": [], "calib": [], "test": []}
    for sp in out:
        for f in sorted((CACHE / sp).glob("*.npz")):
            z = np.load(f, allow_pickle=False)
            m = json.loads(str(z["meta"]))
            c = m["corners"]
            ev = {"id": m["id"], "x_in": z["x_in"], "y": z["y"], "truth_lg": z["truth_lg"], "windows": z["windows"].tolist()}
            ev["meta"] = {"id": m["id"], "title": f"{m['event_type']} {m['time_utc'][:10]}", "event_type": m["event_type"],
                          "corners": c, "bbox": [c["bl"][0], c["bl"][1], c["tr"][0], c["tr"][1]],
                          "issue_time_utc": m["time_utc"]}
            out[sp].append(ev)
    return out


def raw_maps(ev, models):
    lg, ir = ev["x_in"][3].astype("float32"), ev["x_in"][1].astype("float32")
    r = {"persistence": np.stack([persistence(lg)] * 4), "optical_flow": np.stack([optical_flow(lg, ir, f) for f in LEAD_FRAMES])}
    masks = {}
    for sc in SCENARIOS:
        r[sc], masks[sc] = infer(models, ev["x_in"], sc)
    r["light_logreg"] = r["full"]
    return r, masks


def pool(evs, maps, key, li):
    return (np.concatenate([maps[i][key][li].ravel() for i in range(len(evs))]),
            np.concatenate([e["y"][li].ravel() for e in evs]))


def main(args):
    sp = synthetic_events(args.synthetic) if args.synthetic else cache_events()
    tr, ca, te = sp["train"], sp["calib"], sp["test"]
    ids = [e["id"] for s in sp.values() for e in s]
    assert len(ids) == len(set(ids)), "leakage: duplicate event id across splits"          # Guide 23.9 #5
    assert len(ca) >= 2 and len(te) >= 2, "need >=2 calibration and test events"
    print(f"events train/calib/test = {len(tr)}/{len(ca)}/{len(te)}")
    base = {str(L): float(np.mean([e["y"][i].mean() for e in tr])) for i, L in enumerate(LEADS)}
    print("base rate", {k: round(v, 4) for k, v in base.items()})

    models = train_models(tr)
    cA, cB = ca[: len(ca) // 2], ca[len(ca) // 2:]
    mapsA = [raw_maps(e, models)[0] for e in cA]
    mapsB = [raw_maps(e, models)[0] for e in cB]
    keys = METHODS[:2] + list(SCENARIOS)
    iso = {k: {str(L): fit_isotonic(*pool(cA, mapsA, k, i)) for i, L in enumerate(LEADS)} for k in keys}

    def calib(m, k): return np.stack([apply_iso(iso[k][str(L)], m[k][i]) for i, L in enumerate(LEADS)])

    # thresholds + reliability bands on calibration half B (never used to fit the isotonic maps)
    cmB = [{k: calib(m, k) for k in keys} for m in mapsB]
    thr = {str(L): pick_thresholds(np.concatenate([c["full"][i].ravel() for c in cmB]),
                                   np.concatenate([e["y"][i].ravel() for e in cB])) for i, L in enumerate(LEADS)}
    for L, t in thr.items():
        assert 0 <= t["LOW"] <= t["MODERATE"] <= t["HIGH"] <= 1, f"threshold order {L}: {t}"   # #8
        print("thresholds +%s" % L, {k: round(v, 3) for k, v in t.items()})
    bands = {sc: {str(L): reliability_bands([c[sc][i] for c in cmB], [e["y"][i] for e in cB]) for i, L in enumerate(LEADS)}
             for sc in SCENARIOS}

    # held-out test evaluation
    te_raw = [raw_maps(e, models) for e in te]
    te_cal = [{k: calib(m, k) for k in keys} for m, _ in te_raw]
    skill, ablation, rel = {}, {}, {}
    for i, L in enumerate(LEADS):
        b = base[str(L)]
        st = {m: [event_stats(c[("full" if m == "light_logreg" else m)][i], e["y"][i]) for c, e in zip(te_cal, te)] for m in METHODS}
        skill[str(L)] = {m: {"point": aggregate(st[m], b), "ci90": bootstrap(st[m], b)} for m in METHODS}
        for m in ("optical_flow", "light_logreg"):
            skill[str(L)][m]["delta_vs_persistence"] = bootstrap(st[m], b, st["persistence"])
        full_bss = skill[str(L)]["light_logreg"]["point"]["bss"]
        ablation[str(L)] = {}
        for sc in SCENARIOS:
            bss = aggregate([event_stats(c[sc][i], e["y"][i]) for c, e in zip(te_cal, te)], b)["bss"]
            ablation[str(L)][sc] = {"bss": bss, "d_bss": None if bss is None or full_bss is None else bss - full_bss}
        rel[str(L)] = {}
        for m in METHODS:
            p = np.concatenate([c["full" if m == "light_logreg" else m][i].ravel() for c in te_cal])
            y = np.concatenate([e["y"][i].ravel() for e in te])
            bi = np.minimum((p * 10).astype(int), 9)
            rel[str(L)][m] = [{"p_mean": float(p[bi == k].mean()), "obs": float(y[bi == k].mean()), "n": int((bi == k).sum())}
                              for k in range(10) if (bi == k).any()]
    wins = sum(1 for L in LEADS if (skill[str(L)]["light_logreg"]["point"]["bss"] or -9) >
               max(skill[str(L)][m]["point"]["bss"] or -9 for m in METHODS[:2]))
    verdict = (f"On {len(te)} held-out events the lightweight model has a higher Brier skill score than the best baseline at "
               f"{wins} of 4 lead times." + (" Baselines remain competitive at the others — shown in full below." if wins < 4 else ""))

    synth = bool(args.synthetic)
    tag = "SIMULATED" if synth else "ARCHIVED-REAL"
    ds = ({"id": "synthetic", "label": "SIMULATED storms — pipeline smoke test, not real weather", "tag": tag, "region": "-",
           "origin": {s: "Synthetic generator" for s in SRC}} if synth else
          {"id": "sevir", "label": "SEVIR (US) — METHOD VALIDATION, not India skill", "tag": tag, "region": "US",
           "origin": {"ir069": "SEVIR/GOES-16", "ir107": "SEVIR/GOES-16", "vil": "SEVIR/NEXRAD", "lght": "SEVIR/GLM"}})
    caption = ("SIMULATED data — pipeline smoke test. These numbers are not forecast skill." if synth else
               "Method validation on US data (SEVIR). Not a claim of India skill.")
    metrics = {"dataset": ds["id"], "tag": tag, "caption": caption, "n_train_events": len(tr), "n_calib_events": len(ca),
               "n_test_events": len(te), "split": "event-level split: train / calibration (A: isotonic, B: thresholds+bands) / test",
               "base_rate": base, "thresholds_note": "Thresholds chosen on calibration half B; HIGH aims for FAR ≤ 40%; levels are forced into a visible LOW < MODERATE < HIGH ladder; probabilities capped at 98%.",
               "metric_thresholds": [0.1, 0.2, 0.3, 0.5], "skill": skill, "ablation": ablation, "reliability": rel,
               "shipped_model": "light_logreg", "verdict": verdict,
               "notes": ["Generated from the held-out test run; no hand-entered numbers.",
                         "Map corners are an approximation; avoid cell-exact claims."]}

    # export: all test events (cap 12, id order — fixed rule), kind from lead-60 MODERATE threshold
    out = []
    for e, c, (m, masks) in list(zip(te, te_cal, te_raw))[:12]:
        p60, y60 = c["full"][1], e["y"][1]
        f = p60 >= thr["60"]["MODERATE"]
        pos = int(y60.sum())
        kind = ("false_alarm" if f.sum() >= 5 else "quiet") if pos == 0 else ("hit" if (f & (y60 == 1)).sum() / pos >= .5 else "miss")
        export_event(e, {s: c[s] for s in SCENARIOS}, masks, thr, bands, tag, ds["id"])
        out.append({"id": e["id"], "dataset": ds["id"], "title": e["meta"]["title"], "t0_utc": e["meta"]["issue_time_utc"],
                    "kind": kind, "has_alerts": True})
    print("exported kinds:", {k: sum(o["kind"] == k for o in out) for k in ("hit", "miss", "false_alarm", "quiet")})
    layers = {"ir107": ("Satellite cloud-top temperature (10.7 µm)", ds["origin"]["ir107"]), "vil": ("Radar VIL", ds["origin"]["vil"]),
              "lght": ("Lightning flash density", ds["origin"]["lght"]), "risk": ("Model risk polygons", "StormGuard model output"),
              "motion": ("Storm motion vectors", "Optical flow on 10.7 µm")}
    export_globals(out, thr, bands, metrics, ds, layers, out[0]["t0_utc"])
    print(verdict)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", type=int, default=0)
    ap.add_argument("--cache", action="store_true")
    a = ap.parse_args()
    if not a.synthetic and not a.cache:
        ap.error("choose --synthetic N or --cache")
    main(a)
