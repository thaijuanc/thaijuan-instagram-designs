# ThaiJuan Instagram System Documentation

**Version:** 4.0
**Last Updated:** 2026-04-13
**Status:** Production Ready

---

## File Structure

```
content-engine/
├── src/
│   ├── instagram-poster.js      # Posts to Instagram at scheduled time
│   ├── heartbeat-check.js        # Detects new posts, writes message-pending.json
│   ├── notify-juan.js           # Sends Discord webhook notifications
│   └── fetch-analytics.js       # Fetches Instagram analytics (daily 9 AM)
├── config/
│   ├── .env                     # Webhook URLs, tokens (never commit)
│   ├── config.json              # Instagram credentials + settings
│   ├── campaign-schedule.json   # All scheduled posts
│   └── campaign-state.json      # Last post tracking
├── designs/                     # Current campaign designs
├── designs/archive/             # Archived designs (after campaign)
├── docs/                        # Documentation
└── source-images/               # User-uploaded photos
```

---

## Cron Jobs (Active)

```
* * * * * instagram-poster.js      # Every minute: post scheduled content
* * * * * heartbeat-check.js        # Every minute: detect posts, write notifications
* * * * * notify-juan.js            # Every minute: send Discord webhooks
0 9 * * * fetch-analytics.js        # Daily at 9 AM: fetch analytics
```

**Note:** Canva MCP auth is manual — run `mcporter auth canva-mcp` when needed.

---

## Image Naming Convention

**Format:** `YYYY-MM-DD_campaign_slug_HHMM.png`

**Examples:**
- `2026-04-13_monday_buy1get2_0016.png` (current)
- `2026-04-11_weekend_weekend-feast-mode_1515.png` (archive)

**Folders:**
- `designs/` — active campaign images
- `designs/archive/` — completed/archived images

---

## Known Issues & Fixes

### Instagram URL Format
Notifications used to send numeric IDs (`instagram.com/p/18584627212016182`) — broken links.

**Fix:** Script now fetches proper shortcode URL from Instagram Graph API (`instagram.com/p/ABC123xyz/`).

### Notification Delay
Notifications used to take 1-2 minutes due to multi-step file handoff.

**Fix:** `instagram-poster.js` now sends Discord webhook directly after posting (~5 seconds). `notify-juan.js` remains as backup.

### Image 404 After Reorganization
Old designs were moved from root `/` to `designs/` and `designs/archive/` subfolders. Root-path URLs broke.

**Fix:** Updated all URLs in `campaign-schedule.json` to use `designs/archive/` path. Always use the subfolder path format.

---

## Canva MCP Notes

- **Auth:** Manual — `mcporter auth canva-mcp`
- **Generate:** `mcporter call canva-mcp.generate-design` — returns 4 candidates
- **Export:** `mcporter call canva-mcp.export-design` — PNG download
- **Thumbnail previews:** Canva thumbnail URLs are blocked (403) — attach exported PNG directly to Discord

---

## Security

- `.env` contains secrets (webhook URLs, OAuth tokens) — never commit
- Discord webhook URLs are sensitive — treat as passwords
- Instagram access tokens refresh manually or via `auto-refresh-token.js` (manual trigger)
