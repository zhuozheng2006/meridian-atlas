# South Asia Nonlinear Warp & Cross-Era Audit (v3.63)

Reproduce locally:

```bash
python3 docs/verification-3.63/south-asia/audit_v363.py
```

## Verified Results

1. **Quadratic Plate-Curl Test (`055_b.jpg`, 28 edge ticks)**:
   - Under 12-DOF quadratic warp (`reg=1e-4`), Equidistant Conic (`[12N, 26N]`) tightens the 19 fit ticks (`7.684 km -> 2.680 km` RMS), but **degrades** the 9 held-out border ticks (`3.729 km -> 7.629 km` RMS) and worsens interior `Bactria` (`68.84 km -> 93.35 km`).
   - Lambert Conformal Conic (`12-DOF`) blows up interior landmarks (`Pataliputra` `57.98 -> 255.62 km`, `Bactria` `63.18 -> 169.30 km`) while held-out ticks remain `7.891 km`.
   - Changing standard parallels to `[10N, 28N]` under 6-DOF affine changes `Pataliputra` (`57.69 -> 57.42 km`) and `Bactria` (`68.84 -> 68.34 km`) by `<0.5 km`.
   - Conclusion: no quadratic/edge-warp transform can remove the `~57–69 km` interior landmark delta without overfitting edge noise; the `6-DOF` / `4-DOF` affine calibrations in [`docs/verification-3.62/south-asia/`](../../verification-3.62/south-asia/README.md) remain the honest representation and no scan or geometry is warped.

2. **Cross-Era South Asian & Global Polity/Event Audit**:
   - All **17** audited major polities across South Asia (`Maurya`, `Shunga`, `Satavahana`, `Kushan`, `Gupta`, `Chola`, `Mughal`, `Maratha`) and Afro-Eurasia/Americas (`Han`, `Tang`, `Ming`, `Qing`, `Roman`, `Abbasid`, `Mali`, `Inca`, `Ottoman`) have **`0` overlapping same-name intervals**.
   - All **`709` historical events** (including **`55` South Asian events**, spanning Ashoka/Maurya through modern South Asia) pass date ordering and `https://` source verification (`0` issues).
   - Paired with the **9 Pleiades South Asian site congruence checks** in `docs/verification-3.62/south-asia/model-sensitivity-and-congruence.json`, all ancient/classical boundaries and point sites remain unmanipulated and source-faithful.
