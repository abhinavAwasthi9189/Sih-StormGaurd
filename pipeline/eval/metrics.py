"""POD / FAR / CSI / Brier / BSS + event-level bootstrap (Guide Section 9)."""
import numpy as np

THRESHOLDS = [0.10, 0.20, 0.30, 0.50]


def event_stats(p, y, thresholds=THRESHOLDS):
    p = p.astype("float64"); y = y.astype("float64")
    out = {"n": y.size, "brier_sum": float(((p - y) ** 2).sum()), "pos": float(y.sum())}
    for t in thresholds:
        f = p >= t
        out[f"hit_{t}"] = float((f & (y == 1)).sum())
        out[f"miss_{t}"] = float((~f & (y == 1)).sum())
        out[f"fa_{t}"] = float((f & (y == 0)).sum())
    return out


def aggregate(stats, base_rate):
    S = {k: sum(s[k] for s in stats) for k in stats[0]}
    res = {"brier": S["brier_sum"] / S["n"]}
    clim = base_rate * (1 - base_rate)
    res["bss"] = None if clim <= 0 else 1 - res["brier"] / clim
    for t in THRESHOLDS:
        h, m, f = S[f"hit_{t}"], S[f"miss_{t}"], S[f"fa_{t}"]
        res[f"pod_{t}"] = h / max(h + m, 1)
        res[f"far_{t}"] = f / max(h + f, 1)
        res[f"csi_{t}"] = h / max(h + m + f, 1)
    return res


def bootstrap(stats_a, base_rate, stats_b=None, n=500, seed=0):
    rng = np.random.default_rng(seed)
    N = len(stats_a)
    outs = []
    for _ in range(n):
        idx = rng.integers(0, N, N)
        a = aggregate([stats_a[i] for i in idx], base_rate)
        if stats_b is not None:
            b = aggregate([stats_b[i] for i in idx], base_rate)
            a = {k: (None if a[k] is None or b[k] is None else a[k] - b[k]) for k in a}
        outs.append(a)
    res = {}
    for k in outs[0]:
        vals = [o[k] for o in outs if o[k] is not None]
        res[k] = [float(np.percentile(vals, q)) for q in (5, 50, 95)] if vals else None
    return res


def pick_thresholds(p, y):
    """LOW / MODERATE / HIGH on calibration data (Guide 16.1)."""
    p = np.asarray(p).ravel(); y = np.asarray(y).ravel()
    if (y == 1).sum() == 0:
        return {"LOW": 0.05, "MODERATE": 0.2, "HIGH": 0.5}
    rows = []
    for t in np.linspace(0.02, 0.95, 94):
        f = p >= t
        h = (f & (y == 1)).sum(); m = (~f & (y == 1)).sum(); fa = (f & (y == 0)).sum()
        rows.append((t, h / max(h + m, 1), fa / max(h + fa, 1), h / max(h + m + fa, 1)))
    rows = np.array(rows)
    low = max(0.05, rows[rows[:, 1] >= 0.80][-1, 0]) if (rows[:, 1] >= 0.80).any() else 0.05
    mod = rows[np.argmax(rows[:, 3]), 0]
    cand = rows[rows[:, 2] <= 0.40]
    high = cand[0, 0] if len(cand) else float(np.percentile(p[y == 1], 95))
    low = min(low, mod); high = max(high, mod)
    # Presentation rule: always a visible ladder LOW < MODERATE < HIGH (never collapsed into one level).
    mod = min(max(mod, 0.05), 0.85)
    low = min(low, mod * 0.6)
    high = max(high, min(mod * 1.6, (mod + 0.98) / 2))
    return {"LOW": float(max(low, 0.01)), "MODERATE": float(mod), "HIGH": float(min(high, 0.97))}
