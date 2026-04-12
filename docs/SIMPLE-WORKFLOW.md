# ThaiJuan Instagram Workflow

**Version:** 4.0
**Updated:** 2026-04-13
**Status:** LOCKED — Never skip steps

---

## TRUST RULES

1. Don't Skip Steps — Follow exactly as defined
2. Don't Make Things Up — If you don't know, say so
3. Don't Lie — Honest about mistakes immediately
4. Test Things Properly — Verify before reporting success
5. Be Trustworthy — Accuracy > speed
6. Learn From Mistakes — Never repeat the same error
7. Mobile-First Formatting — No extra blank lines, no decorative dashes, compact scannable content
8. Clear System Feedback — Before each step, state what you're about to do + estimated time, then execute

---

## 6-STEP POSTING WORKFLOW

### BEFORE STARTING
When Juan says "create a post":
1. Show the full workflow plan (Steps 1-6 with timing)
2. Show Step 1 draft (headline, promotion, caption, visual, scheduled time)
3. WAIT for approval before proceeding

---

### STEP 1: Draft Content (~2 min)

**Output:**
- Headline
- Promotion/offer
- Caption (with emojis + hashtags)
- Canva MCP prompt
- Scheduled time

**🛑 WAIT FOR APPROVAL — DO NOT proceed until Juan says "yes"**

---

### STEP 2: Generate Design in Canva (~1 min)

**Feedback first:** "Generating design in Canva (~1 min)..." then execute.

**Auth if needed:** `mcporter auth canva-mcp`

**Commands:**
```bash
cd /Users/fenton/.openclaw/workspace

# Generate 1 design
mcporter call canva-mcp.generate-design --timeout 120000 --args '{"query": "[visual direction]","design_type": "instagram_post","user_intent": "[description]"}'

# Convert first candidate to editable
mcporter call canva-mcp.create-design-from-candidate --args '{"job_id": "...","candidate_id": "[first candidate]","user_intent": "Convert to editable"}'

# Export as PNG
mcporter call canva-mcp.export-design --args '{"design_id": "...","format": {"type": "png"},"user_intent": "Export for Instagram"}'

# Download
curl -sL "[export_url]" -o [filename].png

# Upload to GitHub
git add [filename].png && git commit -m "Add [description] design" && git push
```

**Output:** PNG saved to `designs/`, committed to GitHub, stable URL ready.

---

### STEP 3: Download and Commit (~1 min)

After Canva export/download, move to `designs/` and commit to GitHub.

---

### STEP 4: Preview for Approval 🛑 HARD STOP

**Feedback first:** "Design ready! Showing preview for approval..." then show.

**Format:**
```
## [headline]

Promotion: [offer]
Time: [scheduled time]

Caption: [full caption]

[IMAGE ATTACHED]

Edit: https://www.canva.com/d/...

Reply "yes" to approve.
```

- Attach image directly (MEDIA: path) — Discord renders it inline
- No GitHub embed needed
- Include Canva edit link for Juan's reference
- **DO NOT proceed without "yes" or "approve"**

---

### STEP 5: Add to Scheduler (~1 min)

**Feedback first:** "Adding to scheduler and committing to GitHub (~1 min)..." then execute.

**JSON structure:**
```json
{
  "day": "monday-bogo",
  "date": "2026-04-13",
  "dayOfWeek": "Monday",
  "headline": "BUY 1 GET 2 — MONDAY SPECIAL",
  "promotion": "Buy 1 Main, Get 2nd FREE",
  "fullCaption": "...",
  "githubUrl": "https://raw.githubusercontent.com/thaijuanc/thaijuan-instagram-designs/main/designs/2026-04-13_monday_buy1get2_0016.png",
  "scheduledTime": "00:30",
  "posted": false
}
```

**Then:** `git add campaign-schedule.json && git commit -m "Add [headline] [time] scheduled post" && git push`

---

### STEP 6: Automatic (Cron Jobs)

- `instagram-poster.js` runs every minute → posts at scheduled time
- `instagram-poster.js` sends Discord webhook immediately after posting (~5 seconds)
- `heartbeat-check.js` + `notify-juan.js` run every minute as backup notification chain

---

## IMAGE URLS — IMPORTANT

Images live in `designs/` (current) or `designs/archive/` (archived).

**Correct path format:**
```
https://raw.githubusercontent.com/thaijuanc/thaijuan-instagram-designs/main/designs/YYYY-MM-DD_campaign_slug_HHMM.png
https://raw.githubusercontent.com/thaijuanc/thaijuan-instagram-designs/main/designs/archive/YYYY-MM-DD_campaign_slug_HHMM.png
```

**Old root-path URLs (e.g. `main/day4-monday.png`) are broken — always use `designs/` or `designs/archive/` subfolder.**

---

## IF SOMETHING BREAKS

Stop and report:
1. What step failed
2. Error message (exact text)
3. What you tried
4. Suggested fix

Do NOT: skip the step, continue without reporting, or assume it's fine.
