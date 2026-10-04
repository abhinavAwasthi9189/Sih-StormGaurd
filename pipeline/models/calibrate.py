"""Isotonic calibration per lead x scenario + event-level reliability bands (Guide 13)."""
import numpy as np
from sklearn.isotonic import IsotonicRegression


def fit_isotonic(p, y, neg_keep=0.05, seed=0):
    rng = np.random.default_rng(seed)
    pos = y == 1
    keep = pos | (rng.random(len(y)) < neg_keep)
    w = np.where(pos[keep], 1.0, 1.0 / neg_keep)
    iso = IsotonicRegression(y_min=0, y_max=1, out_of_bounds="clip").fit(p[keep], y[keep], sample_weight=w)
    return {"x": iso.X_thresholds_.tolist(), "y": iso.y_thresholds_.tolist()}


def apply_iso(knots, p):
    # never claim certainty from a finite calibration sample
    return np.clip(np.interp(p, knots["x"], knots["y"]), 0.0, 0.98)


BIN_EDGES = [0.0, 0.05, 0.15, 0.3, 0.5, 1.0001]


def reliability_bands(p_list, y_list, n_boot=300, seed=0):
    """One (96,96) array per event. Observed frequency per bin with event-level bootstrap 5-95%."""
    rng = np.random.default_rng(seed)
    E = len(p_list)
    nb = len(BIN_EDGES) - 1
    cnt = np.zeros((E, nb)); pos = np.zeros((E, nb))
    for e, (p, y) in enumerate(zip(p_list, y_list)):
        b = np.digitize(p.ravel(), BIN_EDGES) - 1
        for k in range(nb):
            m = b == k
            cnt[e, k] = m.sum(); pos[e, k] = y.ravel()[m].sum()
    bands = []
    for k in range(nb):
        obs = []
        for _ in range(n_boot):
            idx = rng.integers(0, E, E)
            n = cnt[idx, k].sum()
            if n > 0:
                obs.append(pos[idx, k].sum() / n)
        n_all = int(cnt[:, k].sum())
        bands.append({"p_lo": BIN_EDGES[k], "p_hi": min(BIN_EDGES[k + 1], 1.0), "n": n_all,
                      "obs": float(pos[:, k].sum() / n_all) if n_all else None,
                      "lo": float(np.percentile(obs, 5)) if obs else None,
                      "hi": float(np.percentile(obs, 95)) if obs else None})
    return bands
