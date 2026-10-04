"""Fusion: raw SEVIR arrays -> normalised 96x96 sample + labels (Guide 7.5)."""
import numpy as np
import cv2
from ..config import N_IN, T0, LEAD_FRAMES

LG_SCALE = np.log1p(20)


def norm_ir069(x): return np.clip((x / 100.0 + 30.0) / 30.0, 0.0, 1.0)
def norm_ir107(x): return np.clip((x / 100.0 + 60.0) / 120.0, 0.0, 1.0)
def norm_lg(counts): return np.minimum(np.log1p(counts) / LG_SCALE, 1.0)


def down(a, k, how="mean"):                      # a: (H, W, T)
    H, W, T = a.shape
    a = a.reshape(H // k, k, W // k, k, T)
    return a.mean((1, 3)) if how == "mean" else a.sum((1, 3))


def labels_from_lg(lg):
    """lg: (96,96,49) flash counts. Flash within +-15 min of lead, dilated 5x5 (~8 km)."""
    ys, windows = [], []
    for L in LEAD_FRAMES:
        centre = T0 + L
        start, stop = max(0, centre - 3), min(lg.shape[-1], centre + 4)
        if stop <= start:
            raise ValueError(f"lead {L} has no future frames")
        win = lg[..., start:stop].sum(-1) > 0
        win = cv2.dilate(win.astype("uint8"), np.ones((5, 5), np.uint8)) > 0
        ys.append(win); windows.append([start, stop - 1])   # +180 is edge-clipped (Guide 23.9 #4)
    return np.stack(ys, 0).astype("uint8"), windows


def pack(ir069_n, ir107_n, vil_n, lg_counts):
    """Normalised (96,96,49) planes + raw flash counts -> x_in, y, truth_lg, windows."""
    x = np.stack([ir069_n, ir107_n, vil_n, norm_lg(lg_counts)], 0).astype("float32")
    y, windows = labels_from_lg(lg_counts)
    return x[..., :N_IN].astype("float16"), y, lg_counts[..., T0 + 1:].astype("float16"), windows


def make_sample(ir069, ir107, vil, lght_grid):
    """Raw SEVIR arrays: ir (192,192,49), vil/lght (384,384,49)."""
    return pack(norm_ir069(down(ir069.astype("float32"), 2)), norm_ir107(down(ir107.astype("float32"), 2)),
                down(vil.astype("float32"), 4) / 255.0, np.clip(down(lght_grid.astype("float32"), 4, "sum"), 0, None))
