import numpy as np
from ..config import CELL_KM
from ..models.baselines import flow_field
from .polygons import px_to_lonlat

COLD = 0.25                                    # (-30 C + 60) / 120


def motion_vectors(ir107_hist, corners, step=12):
    f = flow_field(ir107_hist)
    out = []
    for r in range(step // 2, 96, step):
        for c in range(step // 2, 96, step):
            u, v = f[max(r - 3, 0):r + 4, max(c - 3, 0):c + 4].reshape(-1, 2).mean(0)
            kmh = float(np.hypot(u, v) * CELL_KM * 12)
            if kmh < 5 or ir107_hist[r, c, -1] >= COLD:
                continue
            lon, lat = px_to_lonlat(r, c, corners)
            out.append({"lon": round(lon, 4), "lat": round(lat, 4), "kmh": round(kmh, 1),
                        "bearing": round(float((np.degrees(np.arctan2(u, -v)) + 360) % 360), 0)})
    return {"method": "OpenCV Farneback on 10.7 um, 10-min window", "vectors": out}
