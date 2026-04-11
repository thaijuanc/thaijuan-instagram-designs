# ThaiJuan Instagram Automation System

**Version:** 3.0  
**Last Updated:** 2026-04-12  
**Status:** Production Ready ✅

---

## 📁 File Structure

```
content-engine/
├── src/                        # Source code
│   ├── instagram-poster.js     # Auto-posts scheduled content
│   ├── notify-juan.js          # Sends Discord notifications
│   ├── auto-refresh-token.js   # Refreshes OAuth tokens
│   └── heartbeat-check.js      # System health monitoring
│
├── config/                     # Configuration files
│   ├── .env                    # Environment variables (webhook URLs, tokens)
│   ├── campaign-schedule.json  # All scheduled posts
│   └── campaign-state.json     # System state tracking
│
├── docs/                       # Documentation
│   ├── SIMPLE-WORKFLOW.md      # Step-by-step posting workflow
│   ├── SYSTEM-DOCUMENTATION.md # This file
│   └── MARKETING-STRATEGY.md   # Marketing optimization strategy
│
├── designs/                    # Active designs (current week)
│   └── YYYY-MM-DD_campaign_slug_HHMM.png
│
├── designs/archive/            # Historical designs (older than 7 days)
│   └── YYYY-MM-DD_campaign_slug_HHMM.png
│
└── source-images/              # Original photos uploaded by user
    └── [source images]
```

---

## 🏷️ Naming Convention

**Format:** `YYYY-MM-DD_campaign_slug_HHMM.png`

**Examples:**
- `2026-04-11_weekend_weekend-feast-mode_1515.png`
- `2026-04-11_daily_today-only-10-thai-fried-rice_1545.png`
- `2026-04-10_test_notification-test_1133.png`

**Rules:**
1. **Date first** → Sorts chronologically (YYYY-MM-DD)
2. **Campaign type** → `weekend`, `daily`, `flash`, `happy-hour`, `test`
3. **Headline slug** → Lowercase, hyphens, max 30 chars
4. **Time** → 24h format, no colon (HHMM)
5. **Extension** → `.png` always

**Benefits:**
- ✅ Chronological sorting
- ✅ Easy identification
- ✅ No filename conflicts
- ✅ Archive-friendly
- ✅ Human-readable

---

## 🚀 How It Works

### Overview

1. **Create Post** → Follow workflow in `SIMPLE-WORKFLOW.md`
2. **Schedule** → Added to `campaign-schedule.json`
3. **Auto-Post** → Cron runs every minute, posts at scheduled time
4. **Notify** → Discord webhook sent within 5 seconds
5. **Track** → State updated in `campaign-state.json`

### Cron Schedule

```bash
* * * * *     # Instagram poster (posts scheduled content)
* * * * *     # Discord notifier (sends notifications)
* * * * *     # Heartbeat check (system monitoring)
0 */2 * * *   # Token refresh (OAuth, every 2 hours)
0 9 * * *     # Analytics fetcher (daily report at 9 AM)
0 9 * * MON   # Weekly analytics summary (Mondays at 9 AM)
```

### Posting Flow

```
User Request → Content Draft → Canva Design → Export PNG → GitHub Upload
     ↓
Preview Approval → Add to Schedule → Commit → Cron Auto-Posts → Discord Notification
```

---

## 🎨 Canva MCP: Learnings & Issues

### What Works Well

✅ **Text-to-design generation** — Creates designs from detailed prompts  
✅ **Multiple candidates** — Returns 4 design options to choose from  
✅ **Editable designs** — Can convert candidates to editable Canva designs  
✅ **PNG export** — Exports designs as PNG via API  
✅ **OAuth auto-refresh** — Tokens refresh every 2 hours via cron  

---

### Issues Encountered & Workarounds

#### 1. ❌ No Image Previews in Chat
**Issue:** Canva thumbnail URLs are blocked (403 Forbidden), can't show previews in Discord.

**Workaround:**
- Show full Canva URLs for user to click and preview
- After export, attach PNG directly to Discord for approval

**Status:** ⚠️ Workaround in place

---

#### 2. ❌ Can't Upload Custom Images to Canva via MCP
**Issue:** Canva MCP `generate-design` only accepts text prompts, not image attachments. User photos can't be included in design generation.

**Workaround:**
1. Save user's photo to `source-images/` folder
2. Upload to GitHub for stable URL
3. User manually swaps image in Canva editor after design generated
4. Re-export and update GitHub

**Status:** ⚠️ Manual step required

---

#### 3. ❌ No Direct "Use This Image" Parameter
**Issue:** No API parameter to specify "use this image URL in design". MCP generates from text only.

**Workaround:**
- Include image description in text prompt
- Generate design with stock imagery
- User manually replaces with their photo in Canva editor

**Status:** ⚠️ Manual step required

---

#### 4. ❌ OAuth Tokens Expire (3.5 hours)
**Issue:** Canva API tokens expire after ~3.5 hours, causing auth failures.

**Workaround:**
- Cron job runs every 2 hours: `0 */2 * * * node auto-refresh-token.js`
- Refreshes tokens before expiry
- If auth fails: run `mcporter auth canva-mcp` manually

**Status:** ✅ Automated

---

#### 5. ❌ Design Generation is Slow (~1 min)
**Issue:** Canva MCP takes 60+ seconds to generate 4 designs.

**Optimization:**
- Generate only 1 design (first candidate) instead of 4
- Saves ~45 seconds per post
- Less choice, but faster workflow

**Status:** ✅ Optimized

---

#### 6. ❌ Instagram URLs Broken (Numeric IDs)
**Issue:** Notifications sent links like `instagram.com/p/18584627212016182` (numeric ID) which don't work.

**Root Cause:** Instagram uses alphanumeric shortcodes in URLs, not numeric post IDs.

**Fix:**
- Call `fetchInstagramPermalink()` after posting
- Gets proper shortcode URL from Instagram Graph API
- Returns working links like `instagram.com/p/ABC123xyz/`

**Status:** ✅ Fixed

---

#### 7. ❌ Notification Delays (1-2 minutes)
**Issue:** Two-step file handoff caused delays: poster writes file → notifier detects file (up to 1 min later).

**Fix:**
- `instagram-poster.js` sends Discord webhook directly after posting
- notify-juan.js remains as backup safety net
- Notifications arrive in ~5 seconds, not minutes

**Status:** ✅ Fixed

---

#### 8. ❌ No Mobile-First Formatting
**Issue:** Early posts had decorative dashes, extra blank lines, hard to read on mobile.

**Fix:**
- Added "Mobile-First Formatting" to Trust Rules
- No decorative dashes (───)
- No extra blank lines
- Compact, scannable content only

**Status:** ✅ Fixed

---

## 📋 Recommendations for Canva MCP

### High Priority

1. **Add Image Upload Support**
   ```
   Parameter: "image_url": "https://..."
   Use Case: Include user's product photos in generated designs
   ```

2. **Add Thumbnail Preview Support**
   ```
   Return: Accessible thumbnail URLs or base64 thumbnails
   Use Case: Show design previews in chat without requiring clicks
   ```

3. **Add Text Overlay Parameter**
   ```
   Parameter: "text_overlay": { "text": "$15 SPECIAL", "position": "center" }
   Use Case: Generate designs with text already applied, no manual editing
   ```

4. **Faster Generation Mode**
   ```
   Parameter: "fast_mode": true
   Use Case: Generate 1 design in <30 seconds instead of 4 designs in 60 seconds
   ```

---

### Medium Priority

5. **Batch Export**
   ```
   Endpoint: export-designs (plural)
   Use Case: Export multiple designs in single API call
   ```

6. **Direct Instagram Upload**
   ```
   Endpoint: publish-to-instagram
   Use Case: Skip manual export/download/upload workflow
   ```

7. **Design Template Support**
   ```
   Parameter: "template_id": "..."
   Use Case: Reuse brand templates with variable content
   ```

---

### Low Priority

8. **Webhook Notifications**
   ```
   Parameter: "webhook_url": "https://..."
   Use Case: Notify when design generation complete (instead of polling)
   ```

9. **Design Versioning**
   ```
   Feature: Track design revisions
   Use Case: Revert to previous versions, compare changes
   ```

---

## 🛠️ Maintenance

### Daily Checks
- [ ] Cron jobs running: `crontab -l`
- [ ] No pending notifications: `ls message-pending.json`
- [ ] Disk space: `df -h`

### Weekly Tasks
- [ ] Archive old designs (>7 days) to `designs/archive/`
- [ ] Review `campaign-schedule.json` for completed posts
- [ ] Check logs: `/tmp/thaijuan-instagram.log`

### Monthly Tasks
- [ ] Update documentation with new learnings
- [ ] Review and optimize workflow
- [ ] Backup config files

---

## 📊 Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Post on time | 100% | 100% |
| Notification delay | <10 sec | ~5 sec |
| Design generation | <60 sec | ~45 sec |
| Instagram URL format | Working | ✅ Shortcode |
| OAuth failures | 0 | 0 (auto-refresh works) |

---

## 📊 Analytics Tracking

**Metrics Tracked:**
- Impressions (total views)
- Reach (unique accounts)
- Likes, Comments, Saves, Shares
- Engagement rate (calculated)

**Storage:** `config/analytics.json`

**Reports:**
- **Daily:** 9 AM Discord summary (yesterday's posts)
- **Weekly:** Monday 9 AM full week summary
- **On-demand:** Ask "how did post X perform?"

**Script:** `src/fetch-analytics.js`

---

## 🔐 Security

- `.env` file contains secrets (webhook URLs, OAuth tokens)
- Never commit `.env` to GitHub
- Discord webhook URLs are sensitive — treat as passwords
- OAuth tokens auto-refresh, never hardcode
- Analytics data stays local (not shared externally)

---

## 📞 Troubleshooting

### Post Didn't Go Live
1. Check cron: `crontab -l`
2. Check schedule: `cat config/campaign-schedule.json`
3. Check logs: `tail /tmp/thaijuan-instagram.log`

### Notification Not Sent
1. Check webhook URL in `.env`
2. Check `message-pending.json` exists
3. Check logs: `tail /tmp/thaijuan-notify-juan.log`

### Canva Auth Failed
```bash
cd /Users/fenton/.openclaw/workspace
mcporter auth canva-mcp
```

---

**This is a living document. Update it every time the workflow changes.**
