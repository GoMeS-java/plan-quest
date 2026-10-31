# Android interface 0.67 — 2026-10-31

This cycle changes the running game. It does not merge PR #1, deploy the main
GitHub Pages game, alter balance, migrate saves, or add gameplay systems.

## Game changes

- Shared `rpg-ui.css` gives tasks, settings, wardrobe, finances, shop, progress,
  achievements, residents, construction, notifications and app dialogs compact
  typography, stone/metal panels, purple accents and restrained gold details.
- Daily quests use smaller cards, clear title/reward alignment and a read-only
  completion counter. Settings have aligned 44 px controls, a small version
  stamp and collapsed release history instead of oversized pixel headings.
- Mobile navigation has one Sections entry in the bottom dock. The duplicate
  top menu and small extra settings/achievement buttons are hidden. Context
  drawers contain Citadel actions; all game sections are in the section menu.
- Room actions sit outside the scene. Available-height calculations account for
  the header, toolbar, safe areas and dock; the camera remains scrollable and
  restores its position. Room entry resets its own scroll, preserving the title.
- Settings, achievements and menu participate in browser Back; settings and
  achievements trap keyboard focus and return it on close. Native browser
  confirmations for data restoration remain native confirmations.
- Ten opaque, room-specific gothic ruin backdrops add broken lancet windows,
  masonry, rubble, webs and ruined furniture. No furnished WebP image is used
  underneath the initial tier. All original purchased interiors are unchanged.
- UI labels expose renovation levels 0/1/2 as abandoned/restored/luxurious. The
  stored room levels remain 1/2/3; there is no save conversion or demo progress.
- The shared equipped hero has a smaller, shaded face, softer hair palette,
  clothing seams/creases, edge shadows, darker footwear, breathing/blinking and
  alternating arms/legs. Wardrobe and body progression remain shared and intact.
- The PWA manifest permits landscape orientation. New CSS/art are part of the
  build identity and offline cache. The isolated test header identifies 0.67.

## Verification

The original complete regression passed: 45 browser groups, standalone economy,
4 isolated Android-build groups, no runtime errors. Additional default-shell
coverage verifies panels at 320/360/390/430 and 844×390, Back/scroll/settings
persistence, all 10 initial ruins and both paid states, and all rooms after
reload. Screenshots come from the running game with synthetic saves only.
All 79 art assets match the generated build and are listed in the offline cache.
The original WebP interiors and all 30 room-state SVG layers were not replaced.

The isolated publication uses the previous Android-test Site and its existing
owner-only audience. It contains only `build.py --test` output, a separate
plan.android-test.* save namespace, and disabled Google/OAuth/Sheets access.
No personal save is included. A new visitor starts with zero renovation progress.

## Still required before 1.0

Physical Android Chrome/PWA install and update, real viewport/keyboard resizing,
system Back, gestures, background/resume and safe areas. Emulator success is not
physical-device testing. Real Google OAuth/Sheets has not been exercised here;
existing independent-device offline spending limits still apply. Obtain the
owner's actual device feedback before a production release.
