# Android polish 0.68 — 2026-10-31

Only `citadel-development-20261030` / open PR #1. No main update or merge,
no deployment of the main game, no balance changes and no save migration.

## Corrections in the game

- The old document-wide page-swipe listener was still active in the Citadel.
  Panning could hide the entire shell and expose the legacy finance page. The
  legacy gesture/page switch now stays inactive in the RPG shell. The existing
  rank-popup shop action also routes through the shell.
- Fresh camera placement starts at the left edge, preserving the detailed
  default scale. Saved pan/zoom is retained. Explicit Overview fits the width;
  zoom and pinch still support close inspection. Camera controls occupy a
  measured row outside the art, not an overlay over the roof/captions.
- Visible floor/sky/room captions follow the camera. Partly visible room labels
  wrap within the available part of their room and hide only when too little
  room is visible to show a readable label. Hit areas and world layout stay fixed.
- The existing Citadel/resident drawer triggers live in Sections instead of over
  the scene. Room actions remain in the existing toolbar. No new menu is added.
- Dock-only label is `Память`; the menu, accessible name and section title retain
  `Воспоминания`. Tap targets and system safe-area padding are preserved.
- Finance cards use a compact three-column layout and a consistent operation
  form. Empty spending uses a short informative state and a content-sized
  dialog; populated charts retain the original category/amount calculations.
  Missing initial balances show an explicit state instead of a permanent ellipsis.
- Hero face contrast, edge shading and the existing equipped four-frame sheet
  are refined. Walking uses the two actual step frames without stepping beyond
  the sprite sheet. Wardrobe/body progression stays unchanged.

## Validation and artifacts

Synthetic saves only. Added scenarios cover 320/360/390/430 and 844×390,
label bounds, panning/rotation, no artwork overlap, dock wrapping, empty/filled
finances, real form submission, balances against the old implementation,
transaction persistence, reload and Back. Existing tests retain all rooms,
renovation levels, NPCs, quests, save safety, synchronization and offline coverage.
A separate real service-worker test upgrades cached 0.67 to 0.68, verifies the new
stylesheet/dock, the pre-update backup and unchanged synthetic saves, then reloads
offline. Final workflow links are provided with the delivery.

Game screenshots are browser captures, not concepts. The isolated test Site
uses `build.py --test`, the existing test save namespace and disabled Google
synchronization. No synthetic seed or owner data is included in the publication.

## Before 1.0

The owner approved 0.67 on physical Android. This 0.68 cycle uses Chromium mobile
emulation and browser QA, not a physical Android device. Recheck the reported
camera and finance issues on the phone, PWA install/update, system Back, keyboard,
background/resume and safe areas. Real Google OAuth/Sheets remains unverified;
existing multi-device offline-spending limitations remain unchanged.
