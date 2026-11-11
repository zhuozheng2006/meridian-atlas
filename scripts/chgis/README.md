# CHGIS V4 prefecture time series

Source: https://yugong.fudan.edu.cn/CHGIS/sjxz.htm · methodology: https://yugong.fudan.edu.cn/CHGIS/sjsm.htm

The public archive is retained at `public/data/chgis/V4_Prefecture_Bou_TimeSeries.rar`. To rebuild, install Fiona 1.10.1 in a Python virtual environment, copy that archive to `scripts/chgis/.cache/`, extract it there with `bsdtar`, then run `build-prefectures.py` and `verify-prefectures.py` with that Python. Runtime checks are `node scripts/validate-chgis.mjs`.

All 2,016 rows and all source attributes are retained, including three repeated SYS_ID occurrences. Source row numbers disambiguate runtime identities. The 1,322 distinct geometries retain original vertices and rings; exact integer-delta encoding is asserted rather than rounded. The small index loads once, and century geometry packs share requests with a three-pack cache.

This is a regional dataset concentrated in southern/eastern China, spanning annual source intervals from 224 BCE through 1911 CE. It is not a complete national map. BEG_YR/END_YR are treated as inclusive civil years, with year zero excluded from the UI; BEG_RULE/END_RULE remain unexpanded source codes. Within-year overlapping records are retained.

The MapInfo file declares Pulkovo 1942. Longitude/latitude values are preserved for display without an inferred datum shift. The original CRS and archive accompany downloads; no survey-level positional accuracy is claimed. Five display romanizations are corrected from the Chinese name; the original NAME_PY remains in every source record.

The initial OHM early-Korea candidates failed historical review for this batch and are not in the displayed or distributed dataset. See `docs/verification-3.55/early-korea-review.json`.
