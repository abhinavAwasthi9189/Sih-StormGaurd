import numpy as np
from ..config import SCENARIOS, LEADS
from .light_model import feat_map, apply_scenario


def infer(models, x_in, scenario="full"):
    if scenario not in SCENARIOS:
        raise ValueError(f"unknown scenario: {scenario}")
    x2, masks = apply_scenario(x_in.astype("float32"), SCENARIOS[scenario])
    feats = feat_map(x2, masks)
    F, H, W = feats.shape
    X = feats.reshape(F, -1).T
    out = [models[f"{scenario}:{l}"].predict_proba(X)[:, 1].reshape(H, W).astype("float32") for l in LEADS]
    return np.stack(out, 0), masks
