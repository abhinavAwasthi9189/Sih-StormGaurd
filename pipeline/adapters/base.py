from dataclasses import dataclass
import numpy as np


@dataclass
class SourceResult:
    name: str
    array: "np.ndarray | None"
    status: str            # OK | DELAYED | UNAVAILABLE
    provenance: str        # ARCHIVED-REAL | REAL | SIMULATED
    origin: str
    last_update_utc: str
