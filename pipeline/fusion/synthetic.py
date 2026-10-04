"""SIMULATED storms for smoke-testing the pipeline + UI. Never real weather, never a skill claim.
Cold cloud blobs drift and grow/decay; flashes occur where intensity is high and rising."""
import numpy as np
from ..config import GRID
from .build_dataset import pack

T = 49


def make_event(seed, kind="active"):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:GRID, 0:GRID].astype("float32")
    n = {"active": int(rng.integers(1, 4)), "weak": 2, "quiet": 1}[kind]
    s = np.zeros((GRID, GRID, T), "float32")
    for _ in range(n):
        r0, c0 = rng.uniform(22, 74, 2)
        v = rng.uniform(-0.45, 0.45, 2)
        sig = rng.uniform(4, 8)
        amp = {"active": rng.uniform(0.85, 1.3), "weak": rng.uniform(0.35, 0.55), "quiet": 0.3}[kind]
        tpk, w = rng.uniform(8, 44), rng.uniform(10, 22)
        for t in range(T):
            a = amp * np.exp(-((t - tpk) / w) ** 2)
            s[..., t] += a * np.exp(-((yy - (r0 + v[0] * t)) ** 2 + (xx - (c0 + v[1] * t)) ** 2) / (2 * sig ** 2))
    noise = lambda: rng.normal(0, 0.015, (GRID, GRID, T)).astype("float32")
    ir107 = np.clip(0.65 - 0.6 * s + noise(), 0, 1)
    ir069 = np.clip(0.60 - 0.3 * s + noise(), 0, 1)
    vil = np.clip(0.9 * s + noise(), 0, 1)
    growth = np.gradient(s, axis=-1)
    lam = 3.0 * np.clip(s - 0.55, 0, None) ** 2 * (1 + 8 * np.clip(growth, 0, None))
    lg = rng.poisson(lam).astype("float32")
    x_in, y, truth, windows = pack(ir069, ir107, vil, lg)
    return {"x_in": x_in, "y": y, "truth_lg": truth, "windows": windows}
