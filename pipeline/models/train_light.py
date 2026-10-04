"""20 tiny logistic models = 5 scenarios x 4 leads (Guide 11.3)."""
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from ..config import SCENARIOS, LEADS, OUT
from .light_model import feat_map, apply_scenario


def sample_cells(feats, y, n=1500, seed=0):
    rng = np.random.default_rng(seed)
    pos, neg = np.argwhere(y > 0), np.argwhere(y == 0)
    n_pos = min(len(pos), n // 2)
    n_neg = min(len(neg), n - n_pos)
    picks = []
    if n_pos:
        picks.append(pos[rng.choice(len(pos), n_pos, replace=False)])
    if n_neg:
        picks.append(neg[rng.choice(len(neg), n_neg, replace=False)])
    if not picks:
        return np.empty((0, feats.shape[0]), "float32"), np.empty((0,), "int8")
    ij = np.concatenate(picks, 0)
    return feats[:, ij[:, 0], ij[:, 1]].T.astype("float32"), y[ij[:, 0], ij[:, 1]].astype("int8")


def fit_one_lead(X, y):
    m = make_pipeline(StandardScaler(),
                      LogisticRegression(max_iter=250, class_weight="balanced",
                                         solver="lbfgs", random_state=0))
    return m.fit(X, y)


def train_models(train_events, save=True):
    models = {}
    for scenario, dropped in SCENARIOS.items():
        Xs = {l: [] for l in LEADS}
        Ys = {l: [] for l in LEADS}
        for ei, ev in enumerate(train_events):
            x2, masks = apply_scenario(ev["x_in"].astype("float32"), dropped)
            feats = feat_map(x2, masks)                      # once per event x scenario
            for li, lead in enumerate(LEADS):
                X, y = sample_cells(feats, ev["y"][li], 1500, ei * 101 + li)
                if len(y) and len(np.unique(y)) == 2:
                    Xs[lead].append(X); Ys[lead].append(y)
        for lead in LEADS:
            if not Xs[lead]:
                raise RuntimeError(f"No two-class training samples for {scenario} +{lead} min")
            models[f"{scenario}:{lead}"] = fit_one_lead(np.concatenate(Xs[lead]), np.concatenate(Ys[lead]))
    if save:
        OUT.mkdir(exist_ok=True)
        joblib.dump(models, OUT / "light_models.joblib", compress=3)
    return models
