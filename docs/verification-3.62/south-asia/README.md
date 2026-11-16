# South Asia Calibration Sensitivity & Provenance Audit (v3.62)

Reproduce locally without external GIS libraries or network access:

```bash
python3 docs/verification-3.62/south-asia/audit_south_asia.py
```

## Key Verified Findings

1. **Conic Model & Anisotropy Sensitivity (`055_b` 28-tick set)**:
   - Re-evaluating all 3 conic families from `docs/verification-3.61/south-asia/` plus **Ellipsoidal Everest 1830 Equidistant Conic** under both **6-DOF affine** and **4-DOF isotropic similarity**:
   - The `3.73 km` held-out single-coordinate RMS of 6-DOF Spherical Equidistant Conic depends on a `+1.82%` X/Y affine scale anisotropy (`aniso = 1.01823`). Under **4-DOF isotropic similarity**, Equidistant Conic (`12.12 km` fit / `10.80 km` holdout) and Lambert Conformal Conic (`11.58 km` fit / `11.92 km` holdout) converge within `~1 km`, while Everest 1830 degrades (`14.60 km` / `13.17 km`) and Lambert Conformal exhibits the lowest affine page stretch (`1.00992`).
   - Across all 8 model/DOF variants, independent bundled Pleiades settlements retain `52.53–58.87 km` (`Pataliputra`) and `63.18–95.92 km` (`Bactria`) great-circle residuals. No geometry is warped to mask these plate/scan discrepancies.

2. **Cliopatria Annual Polygons vs. Bundled Pleiades Sites (`7 polities, 9 sites`)**:
   - **Maurya (`-250 BCE`)**: Includes `Palibothra`, `Taxila`, `Ozene`, `Barygaza`, `Tagara`, and reaches south into `Kanchipuram` (`12.836°N`), while `Alexandria/Kapisa` falls `54.19 km` outside the northwestern polygon boundary.
   - **Shunga (`-100 BCE`)**: Includes `Palibothra`; `Ozene` sits `150.01 km` outside the polygon.
   - **Kushan (`150 CE`), Satavahana (`100 CE`), Gupta (`450 CE`), Chola (`1025 CE`)**: All audited core sites (`Taxila`, `Kapisa`, `Bactra`, `Barygaza`, `Tagara`, `Palibothra`, `Ozene`, `Kanchipuram`, `Podouke/Arikamedu`) fall inside the corresponding dated polygons.
   - **Vakataka (`450 CE`)**: `Tagara` falls `57.60 km` outside the western Cliopatria Vakataka polygon boundary.

3. **Open Scholarly Vector Source Audit**:
   - **OpenHistoricalMap (ODbL)**: Ancient/classical South Asian polities remain incomplete and unreviewed for `321 BCE–550 CE` snapshots.
   - **`aourednik/historical-basemaps` (GPL-3.0)**: Macro-regional polygons derived from secondary compilations at continental scale; incompatible license for redistribution inside this CC BY 4.0 research asset set and lower temporal resolution than Cliopatria's 8 Maurya / 19 Gupta snapshots.
   - **DSAL Schwartzberg Plates + Verified Pleiades Sites**: Retained cleanly as linked external plates (`III.B.4`, `III.D.1`, `XIV.1`) and bundled Pleiades point settlements without inventing unverified annual boundary vectors.
