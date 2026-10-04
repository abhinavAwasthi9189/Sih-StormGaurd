"""Persistence + optical-flow baselines (Guide Section 10)."""
import numpy as np
import cv2


def persistence(lg_hist):
    recent = (lg_hist[..., -3:].sum(-1) > 0).astype("float32")
    return cv2.GaussianBlur(recent, (0, 0), sigmaX=2.0)


def flow_field(ir107_hist):
    """px per 5 min, from 10.7 um frames -3 and -1 (10 min apart)."""
    a = (ir107_hist[..., -3] * 255).astype("uint8")
    b = (ir107_hist[..., -1] * 255).astype("uint8")
    f = cv2.calcOpticalFlowFarneback(a, b, None, 0.5, 3, 15, 3, 5, 1.2, 0)
    f = cv2.GaussianBlur(f, (0, 0), 6)
    mag = np.linalg.norm(f, axis=-1, keepdims=True)
    f = np.where(mag > 3.0, f * (3.0 / np.maximum(mag, 1e-6)), f)
    return (f / 2.0).astype("float32")


def optical_flow(lg_hist, ir107_hist, lead_frames):
    base = persistence(lg_hist)
    f = flow_field(ir107_hist)
    h, w = base.shape
    gx, gy = np.meshgrid(np.arange(w), np.arange(h))
    mapx = (gx - f[..., 0] * lead_frames).astype("float32")
    mapy = (gy - f[..., 1] * lead_frames).astype("float32")
    return cv2.remap(base, mapx, mapy, cv2.INTER_LINEAR,
                     borderMode=cv2.BORDER_CONSTANT, borderValue=0)
