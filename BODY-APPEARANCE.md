# Shared weight-driven pixel geometry

Visual appearance reads the existing `weights` collection. It never updates weight records or grants rewards. Legacy `bodyStage()` bookkeeping remains compatible; it is not the visual parameter anymore. Its cosmetic pop-up is no longer queued, keeping visual updates quiet and neutral. Existing achievements and economy rules are unchanged.

`bodyMeasurements()` accepts finite kg in the existing input range (30,400), ISO date strings up to today, orders by date, numeric timestamp, then ID. The latest entry wins, not the minimum of a fortnight. No smoothing or history minimum is applied, so gaining and losing are reversible and deterministic. Small fluctuations are naturally limited by pixel quantization.

Without a configured visual goal, `bodyShape()` linearly interpolates the existing BODY_F coefficients across BODY_TH anchors, extending the first anchor by the first interval. Outside this legacy range it clamps to the end silhouette; no personal values were added. Missing/invalid-only weights use the original full silhouette. This is a game appearance mapping, not a medical body-composition estimate.

An optional `cfg/body-appearance.goal` uses the earliest valid existing measurement as its start. For goal below start, f = clamp(1 - (1 - minimum BODY_F) * (start - latest)/(start - goal), minimum BODY_F, 1). Blank disables this option. No weight is suggested. The setting is stored through the normal DB queue and sync; old saves need no migration. Existing fixed historical progress targets are not reinterpreted as user-supplied settings. This visual-only target does not change their calculations or rewards.

`squeezeBody()` inverse-samples composed garment/skin rows on the 32×52 grid with nearest-neighbour rounding. Strength varies across shoulders, abdomen, hips and legs; no vertical coordinates change. Hair and eye region remain untouched, outer cheek pixels are subtly trimmed at narrower shapes. Garments, hands and trousers are transformed together before the outline pass. Pixel changes are necessarily discrete even though the parameter is continuous; not every small measurement changes a visible pixel.

The same parameter is recomputed by wardrobe rendering and Citadel sync. Wardrobe cache keys include its continuous value, and the existing animation sheet cache is regenerated when pixels change. No CSS horizontal scaling, alternate avatars, separate measurements, per-frame JS loop or duplicated save data were added.

Synthetic browser tests cover intermediate weights, reverse changes, identical hair/height, every built-in outfit, parity of three canvas views, new measurement through the UI, optional goal, future records, reload and preservation of original records/financial data. Existing full suites cover animations, rooms, purchases, mobile layout, PWA and isolated TEST build.
