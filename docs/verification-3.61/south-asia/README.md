# South Asia plate calibration and dated reading evidence

This directory contains research inputs, not approved political boundaries. south-asia-review.json provides four bilingual reading notes with explicit date qualifiers and approximate text locations on the original image.

Reproduce with Python and NumPy, without a GIS package or network:

    python fit_graticule.py
    python check_landmarks.py --repo /absolute/path/to/world-history-atlas

Twenty-eight manually read edge ticks constrain one coordinate each, with 19 fitting constraints and 9 fixed holdouts. The atlas states a conic projection with 12N/26N standard parallels and central meridian 80E. Conic family and datum are unspecified. Three spherical candidate families are compared.

The equidistant-conic candidate gives a 3.73 km held-out single-coordinate RMS, but a 24.18 km maximum fitting residual. Two independent capital-symbol checks, never used in fitting, differ from bundled Pleiades locations by 57.69 and 68.84 km. All three models retain substantial landmark errors. These results do not establish kilometre-scale spatial accuracy or historical boundary accuracy.

Source JPGs were downloaded for local inspection; original bytes and source rights are retained. For a public source repository, preserve source URLs, hashes, controls, scripts and original reading notes rather than automatically mirroring source scans.

The Pleiades live page returned bot protection; no bypass was attempted. Independent checks use existing project data with hashes recorded. No modern political boundaries are substituted, no city-based warp conceals graticule discrepancies, and no period-spanning map is treated as an annual polygon.
