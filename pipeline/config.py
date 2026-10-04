"""Single source of truth for grid, leads, scenarios, paths (Guide Sections 7.5, 11)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_DATA = ROOT / "web" / "public" / "data"
OUT = ROOT / "outputs"
CACHE = ROOT / "data" / "cache"          # *.npz per event (git-ignored)

GRID = 96
N_IN = 13                                 # 13 x 5 min history
T0 = N_IN - 1                             # index 12 = issue ("now") frame
LEADS = [30, 60, 120, 180]                # minutes
LEAD_FRAMES = [6, 12, 24, 36]             # 5-min frames
SRC = ["ir069", "ir107", "vil", "lght"]
CELL_KM = 4.0
SCENARIOS = {
    "full": [],
    "no_radar": ["vil"],
    "no_lightning": ["lght"],
    "no_satellite": ["ir069", "ir107"],
    "satellite_only": ["vil", "lght"],
}
TAGS = ("REAL", "ARCHIVED-REAL", "SIMULATED")
BOX = (83.0, 19.6, 88.2, 24.4)            # W, S, E, N  (study box, Guide 23.1)
DISCLAIMER = "Decision-support prototype — not an official IMD warning."
