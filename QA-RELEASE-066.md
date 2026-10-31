# Release regression — 0.66 (2026-10-31)

Scope: `citadel-development-20261030`, PR #1. No production deployment,
merge, balance change, save migration, or new gameplay feature.

## Failure and correction

The original run 41192566669 timed out on `#citadel-upgrade`. In the default
Citadel shell, entering a room selects `data-ui-view="room"`, whose CSS
intentionally hides `.citadel-building`. The synthetic rank and essence were
sufficient; the test was trying to purchase from a hidden panel.

Commit df2b011 attempted to open the panel through `[data-art-view="upgrades"]`,
but the shell intentionally hides that classic navigation too. Runs 41200055213
and 41200058652 therefore timed out on that hidden navigation control.

The corrected test opens the visible right room drawer and presses `Улучшить`,
then asserts the `upgrades` view and the visible, enabled purchase button before
clicking it. No forced clicks, timeout increases, skipped checks, or economy
changes were used.

## Added coverage

- Default shell purchases at 320, 360, 390 and 430 px, plus 844×390 landscape.
- Both paid renovations, exact essence balance changes of 5 then 12, stale
  repeated request rejection, and disabled completed purchase control.
- Room states 1/2/3, independent unrenovated room, and durable level/balance after
  reload. Pre-existing synthetic documents remain unchanged.
- Existing standalone economy regression now runs in GitHub Actions before the
  browser suite.

Version stays 0.66: only regression tests and CI coverage changed; game code and
built application bytes are unchanged.

## Verification

Confirmed green workflow on the final test code:
https://github.com/GoMeS-java/plan-quest/actions/runs/41202007673
(commit 0a9584f0a450170cc2d52dd689e16a1862a4d8c9).

The complete CI runs the build/assets and integration contracts, JavaScript
syntax, standalone economy checks, all 45 browser scenario groups, and all 4
Android-build isolation groups. The browser suite covers all 10 rooms / 5 tiers,
renovations and reload, doors, NPCs, camera/zoom, section navigation, storage
failures, synthetic Sheets conflicts, backup/restore, and offline PWA updates.

Local Chromium 153.0.8010.0 also passed all 45 browser groups on the initial fix,
the expanded five-size shell purchase scenario on the final test code, and all
4 isolation groups. All 69 Citadel assets match source and are offline-cached;
JavaScript syntax and generated `docs/` parity passed. No personal saves or
real OAuth/Sheets were used. No browser runtime errors were reported.

## Physical-device limits

Chromium mobile emulation is not physical Android validation. Still check real
Android Chrome/PWA installation and update, pinch/scroll feel, system Back,
background/resume, keyboard and safe-area behavior. Real Google OAuth and
personal Sheets were not used; synchronization tests use synthetic API replies.
Existing cross-device offline overspending limits in QA-CITADEL.md still apply.
