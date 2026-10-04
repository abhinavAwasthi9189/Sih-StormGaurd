"""Feature extraction + scenario handling (Guide Section 11). Shared by train and infer."""
import numpy as np
import cv2
from ..config import SRC
from .baselines import flow_field


def apply_scenario(x, dropped):
    x = x.copy()
    m = np.ones(4, dtype="float32")
    for s in dropped:
        if s not in SRC:
            raise ValueError(f"unknown source: {s}")
        i = SRC.index(s)
        x[i] = 0
        m[i] = 0
    return x, m


def feat_map(x_in, masks=None):
    """x_in: (4,96,96,13) [ir069, ir107, vil, lght] -> (19,96,96) float32."""
    ir069, ir107, vil, lg = (x_in[i].astype("float32") for i in range(4))
    if masks is None:
        masks = np.ones(4, dtype="float32")
    l5, l15, l30 = lg[..., -1], lg[..., -3:].sum(-1), lg[..., -6:].sum(-1)
    local_l = cv2.GaussianBlur(l15, (0, 0), 1.5)
    local_v = cv2.GaussianBlur(vil[..., -1], (0, 0), 1.5)
    cool15 = ir107[..., -1] - ir107[..., -4]
    cool30 = ir107[..., -1] - ir107[..., -7]
    vilchg = vil[..., -1] - vil[..., -4]
    lgtrend = l15 - (l30 / 2.0)
    flow = flow_field(ir107)
    fu, fv = flow[..., 0], flow[..., 1]
    dynamic = np.stack([l5, l15, l30, lgtrend, ir107[..., -1], cool15, cool30,
                        ir069[..., -1], vil[..., -1], vilchg,
                        np.sqrt(fu ** 2 + fv ** 2), fu, fv, local_l, local_v], 0)
    H, W = dynamic.shape[1:]
    mp = np.broadcast_to(np.asarray(masks, "float32")[:, None, None], (4, H, W))
    feats = np.concatenate([dynamic, mp], 0)
    return np.nan_to_num(feats, nan=0.0, posinf=0.0, neginf=0.0).astype("float32")
