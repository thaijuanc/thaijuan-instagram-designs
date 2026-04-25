# Data Directory

Runtime data lives here locally and should not contain secrets.

Expected local files:

- `restaurants.json` — discovered restaurant candidates
- `content-drafts.json` — generated draft posts awaiting approval
- `analytics.json` — Instagram performance snapshots
- `strategy-notes.json` — weekly learnings and updated strategy

These files are intentionally ignored by git until we decide which ones should become versioned fixtures.
