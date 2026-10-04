"""EN/HI templates (Guide 17.1) + pre-built exercise alerts."""
TEMPLATES = {
    "levels": {
        "LOW": {"en": "LOW lightning risk", "hi": "बिजली गिरने का कम जोखिम", "icon": "info", "pattern": "dot"},
        "MODERATE": {"en": "MODERATE lightning risk", "hi": "बिजली गिरने का मध्यम जोखिम", "icon": "triangle", "pattern": "dash"},
        "HIGH": {"en": "HIGH lightning risk", "hi": "बिजली गिरने का उच्च जोखिम", "icon": "octagon", "pattern": "solid"},
    },
    "level_word": {"LOW": {"en": "LOW", "hi": "कम"}, "MODERATE": {"en": "MODERATE", "hi": "मध्यम"}, "HIGH": {"en": "HIGH", "hi": "उच्च"}},
    "headline": {"en": "{level} near {place} — within {lead} min", "hi": "{level} — {place} के पास, अगले {lead} मिनट में"},
    "body": {
        "en": "Probability {p}% (similar past cases: {lo}–{hi}%). Based on {sources}. Go indoors or into a vehicle; stay away from open fields, trees, poles and water. Decision-support only — not an official IMD warning.",
        "hi": "संभावना {p}% (समान पिछले मामलों में: {lo}–{hi}%)। आधार: {sources}। पक्की इमारत या वाहन में जाएँ; खुले मैदान, पेड़, खंभे और पानी से दूर रहें। यह केवल निर्णय-सहायता है, IMD की आधिकारिक चेतावनी नहीं।",
    },
    "sms": {
        "en": "EXERCISE-StormGuard: {level} lightning risk near {place} in ~{lead} min (P {p}%). Go indoors; avoid open ground, trees, water. Not an IMD warning.",
        "hi": "अभ्यास-StormGuard: {place} के पास ~{lead} मिनट में बिजली का {level_hi} जोखिम (संभावना {p}%)। भीतर जाएँ; खुले मैदान, पेड़, पानी से दूर रहें। IMD चेतावनी नहीं।",
    },
    "instruction": {"en": "Seek shelter in a sturdy building or vehicle.", "hi": "पक्की इमारत या वाहन में शरण लें।"},
    "no_risk": {"en": "No MODERATE or HIGH lightning risk in the next 180 min at this point.",
                "hi": "इस स्थान पर अगले 180 मिनट में मध्यम या उच्च बिजली जोखिम नहीं है।"},
}
SRC_LABEL = {"ir069": "water-vapour satellite", "ir107": "cloud-top satellite", "vil": "radar", "lght": "lightning"}


def fill(tpl, **kw):
    return tpl.format(**kw)


def build_alerts(event_id, tag, dataset, scenario_maps, thr, bands_for, templates=TEMPLATES, max_n=6):
    """scenario_maps: {lead: (p(96,96), corners_lonlat_fn)}; only 'full' scenario is pre-built."""
    alerts = []
    for lead, (p, lonlat, masks) in scenario_maps.items():
        t = thr[str(lead)]
        pm = float(p.max())
        lvl = "HIGH" if pm >= t["HIGH"] else "MODERATE" if pm >= t["MODERATE"] else None
        if lvl is None:
            continue
        r, c = np_unravel(p)
        lon, lat = lonlat(r + 0.5, c + 0.5)
        lo, hi = bands_for(lead, pm)
        src = ", ".join(SRC_LABEL[s] for s, m in zip(["ir069", "ir107", "vil", "lght"], masks) if m) or "no sources"
        place = f"{lat:.2f}°N {lon:.2f}°E"
        kw = dict(level=templates["level_word"][lvl]["en"], level_hi=templates["level_word"][lvl]["hi"],
                  place=place, lead=lead, p=round(pm * 100), lo=round(lo * 100), hi=round(hi * 100), sources=src)
        alerts.append({
            "event_id": event_id, "status": "EXERCISE", "tag": tag, "dataset": dataset, "scenario": "full",
            "level": lvl, "lead": lead, "p": round(pm, 3), "lo": round(lo, 3), "hi": round(hi, 3),
            "lat": round(lat, 4), "lon": round(lon, 4), "place": place,
            "headline": {l: fill(templates["headline"][l], **{**kw, "level": templates["level_word"][lvl][l]}) for l in ("en", "hi")},
            "body": {l: fill(templates["body"][l], **kw) for l in ("en", "hi")},
            "sms": {l: fill(templates["sms"][l], **kw) for l in ("en", "hi")},
        })
    return alerts[:max_n]


def np_unravel(p):
    import numpy as np
    return np.unravel_index(int(np.argmax(p)), p.shape)
