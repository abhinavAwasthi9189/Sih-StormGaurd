# Data sources and event-selection rule

## Event selection rule (fixed before looking at outputs)
Export **all held-out test events, up to 12, in ID order**. Each event's `kind` is assigned by a fixed rule at +60 min,
using the calibrated full-feed forecast and the MODERATE threshold:
- no flash in the label window: `false_alarm` if >= 5 cells are forecast at MODERATE or higher, else `quiet`
- flashes present: `hit` if >= 50% of flash cells are forecast, else `miss`
If a build has no miss or no false alarm among its test events, say so; do not swap events in.

## Track S (SEVIR, US) - method validation only
Adapter written, **not yet run**: needs network + `s3fs`. First real run must pass Guide Section 23.9 checks, and
`lght_to_grid` must be compared with the official SEVIR helper before any score is shown.

## Track I (India) - not started
Fill in after T-I1/T-I2: MOSDAC products, cadence, radar yes/no, ERA5/IMERG requests, lightning-label answer.
