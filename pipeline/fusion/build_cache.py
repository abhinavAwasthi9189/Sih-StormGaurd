"""Track S: stream chosen SEVIR events -> data/cache/{split}/{id}.npz. `python -m pipeline.fusion.build_cache 30`"""
import sys, json, numpy as np
from ..adapters import sevir
from ..config import CACHE, T0
from .build_dataset import make_sample


def split_of(t):
    t = str(t)[:10]
    return "train" if t < "2019-03-01" else "val" if t < "2019-06-01" else "calib" if t < "2019-08-01" else "test"


def main(n=30):
    cat = sevir.load_catalog(); fs = sevir._fs()
    for eid in cat.id.drop_duplicates().sample(n, random_state=0):
        rows = cat[cat.id == eid]
        arr = {m: sevir.read_event(rows, m, fs) for m in sevir.MODS}
        assert arr["ir107"].shape == (192, 192, 49) and arr["vil"].shape == (384, 384, 49)
        x_in, y, truth, windows = make_sample(arr["ir069"], arr["ir107"], arr["vil"], sevir.lght_to_grid(arr["lght"]))
        r = rows.iloc[0]
        offs = str(r.minute_offsets)
        d = CACHE / split_of(r.time_utc); d.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(d / f"{eid}.npz", x_in=x_in, y=y, truth_lg=truth, windows=np.array(windows),
                            meta=json.dumps({"id": eid, "time_utc": str(r.time_utc), "event_type": str(r.event_type),
                                         "corners": {k: [float(v) for v in c] for k, c in sevir.corners_from_row(r).items()},
                                         "minute_offsets": offs, "issue_idx": T0}))


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 30)
