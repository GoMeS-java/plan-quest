# 0.72: progress persistence and CI regression

Synthetic data only. Production, main, personal Sheets and Avito are untouched.

## Reproduction and cause

The original browser regression reproduced intermittently on Chromium 153. Both game queues had resolved, but the reading renderer's localStorage view still contained only one newly written flag. The other renderer already contained both. Queue completion is not a cross-renderer storage-notification barrier. The test read immediately without observing both tabs converge. The read did not establish durable data loss.

A separate real defect existed in recordRare: it marked the in-memory state before persistence, returned no operation promise, and could silently ignore an event before all initial subscriptions completed. A failed write could therefore appear successful and suppress a retry. The cached-state existence check also did not establish the first committed observation atomically.

## Change

- recordRare returns the existing game queue's operation promise and reads/writes the current document in the existing localdb transaction under its Web Lock.
- The first committed value for an already-recorded monotonic flag remains unchanged; replays do not rewrite its timestamp/revision. Sibling and unknown fields remain intact.
- The UI observes committed snapshots rather than an optimistic flag. Failures reject to callers and retain the existing storage error reporting. Fire-and-forget event callers consume the already-reported rejection.
- The existing regression awaits initial readiness, both operation promises and actual storage convergence in both tabs. It does not increase a timeout or add a sleep.
- Twelve additional operation orders use an explicitly held/released real Web Lock. They verify both flags, nested unknown fields, weekly and daily progress, offline writes, replay and reload.
- A separate quota-error regression verifies rejection, unchanged durable/in-memory progress and successful retry/reload.

## Validation

Targeted run: three scenario groups passed, including all twelve ordered cross-tab iterations. Full suite and GitHub Actions results are recorded in the delivery report after completion.

The existing full regression also covers duplicate reward prevention, backup restoration, stale remote data, cloud conflict handling and PWA offline reload. No achievement definitions, conditions, rewards, economy rules or schema have changed.

## Limits

Desktop Chromium with mobile viewports is not a physical Android device or real OAuth verification. The existing fallback without Web Locks does not provide a cross-tab transaction guarantee. Independent offline devices and full-sheet cloud PUTs remain subject to the existing conflict protocol; this change does not claim a distributed transaction.
