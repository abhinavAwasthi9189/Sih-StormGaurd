"""Risk contours -> GeoJSON (Guide 16.2). OpenCV only (no shapely/skimage). Nested: HIGH in MODERATE in LOW."""
import numpy as np
import cv2
from ..config import GRID

LEVELS = ["LOW", "MODERATE", "HIGH"]          # draw order: biggest first


def px_to_lonlat(r, c, corners):
    u, v = c / GRID, r / GRID
    top = np.array(corners["tl"]) * (1 - u) + np.array(corners["tr"]) * u
    bot = np.array(corners["bl"]) * (1 - u) + np.array(corners["br"]) * u
    return (top * (1 - v) + bot * v).tolist()


def risk_polygons(p, thr, corners, min_cells=3):
    ps = cv2.GaussianBlur(p.astype("float32"), (0, 0), 1.0)
    feats = []
    for lvl in LEVELS:
        t = thr[lvl]
        mask = np.pad((ps >= t).astype("uint8"), 1)
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in cnts:
            if cv2.contourArea(cnt) < min_cells:
                continue
            cnt = cv2.approxPolyDP(cnt, 0.5, True).reshape(-1, 2) - 1       # undo pad, (x=c, y=r)
            if len(cnt) < 3:
                continue
            fill = np.zeros(ps.shape, "uint8")
            cv2.fillPoly(fill, [cnt.astype(np.int32)], 1)
            pmax = float(p[fill == 1].max()) if fill.any() else float(t)
            ring = [[round(x, 4) for x in px_to_lonlat(float(r) + 0.5, float(c) + 0.5, corners)] for c, r in cnt]
            ring.append(ring[0])
            feats.append({"type": "Feature",
                          "properties": {"level": lvl, "p_max": round(pmax, 3), "threshold": round(float(t), 3)},
                          "geometry": {"type": "Polygon", "coordinates": [ring]}})
    return {"type": "FeatureCollection", "features": feats}
