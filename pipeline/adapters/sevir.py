"""Track S adapter (Guide 7.3-7.4). NOT run in this build: needs network + s3fs.
VERIFY on first run: `fs.ls`, and compare lght_to_grid against the official helper
(MIT-AI-Accelerator/eie-sevir, sevir/utils.py). If they differ beyond rounding, trust the helper."""
import numpy as np
import pandas as pd

BUCKET = "sevir"
MODS = ["ir069", "ir107", "vil", "lght"]


def _fs():
    import s3fs
    return s3fs.S3FileSystem(anon=True)


def load_catalog(path="data/raw/CATALOG.csv"):
    cat = pd.read_csv(path, parse_dates=["time_utc"], low_memory=False)
    ok = cat[cat.img_type.isin(MODS)]
    counts = ok.groupby("id").img_type.nunique()
    ok = ok[ok.id.isin(counts[counts == 4].index)]
    pct = ok[ok.img_type != "lght"].groupby("id").pct_missing.max()
    return ok[ok.id.isin(pct[pct <= 5].index)]


def read_event(rows, mod, fs=None):
    import h5py
    fs = fs or _fs()
    r = rows[rows.img_type == mod].iloc[0]
    with fs.open(f"{BUCKET}/data/{r.file_name}", "rb", block_size=8 * 2 ** 20) as f:
        with h5py.File(f, "r") as h:
            return h[r.id][:] if mod == "lght" else h[mod][int(r.file_index)]


def lght_to_grid(flash, t_unit_s=1.0, n_frames=49):
    """ASSUMPTION: columns [time, lat, lon, x, y], x/y in 384x384 frame, time in seconds from event start.
    Replace with the official helper after checking its time unit."""
    g = np.zeros((384, 384, n_frames), "float32")
    if len(flash) == 0:
        return g
    tb = np.floor(flash[:, 0] * t_unit_s / 300.0).astype(int)
    x, y = flash[:, 3].astype(int), flash[:, 4].astype(int)
    ok = (tb >= 0) & (tb < n_frames) & (x >= 0) & (x < 384) & (y >= 0) & (y < 384)
    np.add.at(g, (y[ok], x[ok], tb[ok]), 1)
    return g


def corners_from_row(r):
    bl, tr = (r.llcrnrlon, r.llcrnrlat), (r.urcrnrlon, r.urcrnrlat)
    return {"bl": list(bl), "tr": list(tr), "tl": [bl[0], tr[1]], "br": [tr[0], bl[1]]}
