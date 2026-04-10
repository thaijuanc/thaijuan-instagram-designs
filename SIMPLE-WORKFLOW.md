# ThaiJuan Instagram Workflow — SIMPLE VERSION

**Version:** 2.0 (Simplified)  
**Created:** 2026-04-10  
**Status:** LOCKED — Never skip steps

---

## 🎯 TRUST RULES (Apply to ALL Workflows)

1. **Don't Skip Steps** — Follow exactly as defined
2. **Don't Make Things Up** — If you don't know, say so
3. **Don't Lie** — Honest about mistakes immediately
4. **Test Things Properly** — Verify before reporting success
5. **Be Trustworthy** — Accuracy > speed
6. **Learn From Mistakes** — Never repeat the same error

**File:** `/Users/fenton/.openclaw/workspace/TRUST-RULES.md`

---

## 📋 The 8-Step Workflow

### Step 1: Draft Content ⏱️ ~2 min
**What:** Define what you want to post

**Output:**
- Headline
- Promotion/offer
- Caption (with emojis + hashtags)
- Visual direction for Canva
- **Scheduled time** (when should this post?)

**Example:**
```
Headline: FRIDAY NIGHT FEAST
Promotion: $79 Big Platter - Feeds 2
Caption: "FRIDAY NIGHT = FEAST MODE! 🔥..."
Visual: "Epic Thai platter spread, bold colors..."
Scheduled: 3:56 PM today
```

---

### Step 2: Generate Canva Design ⏱️ ~1 min
**Command:**
```bash
mcporter call canva-mcp.generate-design --timeout 120000 --args '{"query": "[visual direction]","design_type": "instagram_post","user_intent": "[description]"}'
```

**Output:**
- 4 design candidates
- Select best one
- Get `candidate_id`

---

### Step 3: Export & Upload to GitHub ⏱️ ~2 min
**Commands:**
```bash
# Convert to editable
mcporter call canva-mcp.create-design-from-candidate --args '{"job_id": "...","candidate_id": "...","user_intent": "Convert to editable"}'

# Export as PNG
mcporter call canva-mcp.export-design --args '{"design_id": "...","format": {"type": "png"},"user_intent": "Export for Instagram"}'

# Download
curl -sL "[export_url]" -o [filename].png

# Upload to GitHub
git add [filename].png
git commit -m "Add [description] design"
git push
```

**Output:**
- PNG file saved locally
- Committed to GitHub
- Stable URL: `https://raw.githubusercontent.com/thaijuanc/thaijuan-instagram-designs/main/[filename].png`

---

### Step 4: ⏸️ HARD CHECKPOINT — Show Preview & WAIT ⏱️ ∞
**What:** Show Juan the design and **WAIT FOR APPROVAL**

**Output to Juan:**
```markdown
## Step 4: Preview for Approval

### 🎨 Design Preview
**Canva Edit URL:** [url]
**GitHub Image URL:** [url]

### 📝 Content
**Headline:** [headline]
**Promotion:** [promotion]
**Caption:** [full caption]

### ⏰ Scheduled Time
**Post at:** [time]

---

### ⏳ WAITING FOR YOUR APPROVAL

**To approve:** Say "yes" or "approve"
**To request changes:** Tell me what to adjust

**I will NOT proceed without your approval.**
```

**HARD RULE:** 🛑 **STOP HERE. DO NOT PROCEED WITHOUT "YES".**

---

### Step 5: Create Google Calendar Event ⏱️ ~30 sec
**Command:**
```bash
gog calendar create primary \
  --summary="📱 Instagram: [HEADLINE] - ThaiJuan" \
  --from="[date]T[time]+10:00" \
  --to="[date]T23:59:00+10:00" \
  --description="[caption]\n\nCanva Edit: [url]" \
  --attachment="[github_url]"
```

**Output:**
- Calendar event created
- Event ID and link

---

### Step 5b: Add to Scheduler ⏱️ ~1 min
**What:** Add post to `campaign-schedule.json`

**JSON Structure:**
```json
{
  "day": "1k",
  "date": "2026-04-10",
  "dayOfWeek": "Friday",
  "headline": "FRIDAY NIGHT FEAST",
  "promotion": "$79 Big Platter - Feeds 2",
  "fullCaption": "FRIDAY NIGHT = FEAST MODE! 🔥...",
  "githubUrl": "https://raw.githubusercontent.com/.../filename.png",
  "scheduledTime": "15:56",
  "posted": false
}
```

**Then:**
```bash
git add campaign-schedule.json
git commit -m "Add [headline] [time] scheduled post"
git push
```

---

### Step 6: Auto-Post at Scheduled Time ⏱️ Automatic
**What:** Cron runs `instagram-poster.js` every minute

**Cron Schedule:**
```bash
* * * * * node instagram-poster.js
```

**What Happens:**
- Script scans ALL posts in schedule
- Finds posts where: `date === today` AND `scheduledTime === currentTime` AND `posted === false`
- Posts to Instagram
- Updates schedule + state files
- Writes notification file

---

### Step 7: Automatic Notification ⏱️ Within 2 min
**What:** Heartbeat checker finds notification and alerts Juan

**Heartbeat Schedule:**
```bash
*/2 * * * * node heartbeat-check.js
```

**Notification Format:**
```
✅ Post published: [headline]
📌 Post ID: [postId]
🎯 Promotion: [promotion]
🔗 https://www.instagram.com/p/[postId]
```

---

### Step 8: Update State ⏱️ Automatic
**What:** Script updates `campaign-state.json`

**Fields Updated:**
- `lastPostDate`
- `lastPostId`
- `updatedAt`

---

## 🛑 HARD CHECKPOINTS

### Checkpoint 1: After Step 3
**Before proceeding to Step 5:**
- ✅ Design generated?
- ✅ Exported as PNG?
- ✅ Uploaded to GitHub?
- ⏸️ **SHOW JUAN AND WAIT FOR "YES"**

### Checkpoint 2: After Step 5b
**Before reporting "done":**
- ✅ Calendar event created?
- ✅ Added to scheduler?
- ✅ Committed to GitHub?
- ✅ Confirmed cron is running?

---

## 📁 File Structure

```
/Users/fenton/.openclaw/workspace/
├── TRUST-RULES.md              # Core operating principles
├── LESSONS-LEARNED.md          # Mistakes + lessons
│
└── thai-restaurant/content-engine/
    ├── instagram-poster.js     # Main posting script (SIMPLE)
    ├── heartbeat-check.js      # Notification checker
    │
    ├── campaign-schedule.json  # All scheduled posts
    ├── campaign-state.json     # Posting progress
    │
    ├── SIMPLE-WORKFLOW.md      # This file
    ├── TRUST-RULES.md          # Local copy
    │
    └── [design files].png      # All design images
```

---

## 🔧 Cron Configuration

**View:**
```bash
crontab -l
```

**Expected:**
```bash
# Post every minute
* * * * * node instagram-poster.js

# Check notifications every 2 minutes
*/2 * * * * node heartbeat-check.js

# Refresh tokens every 3 hours
0 */3 * * * node auto-refresh-token.js
```

---

## ⚠️ If Something Breaks

**Stop and report:**
1. What step failed
2. Error message (exact text)
3. What you tried
4. Suggested fix

**Do NOT:**
- Skip the broken step
- Continue without reporting
- Assume it's fine

---

## 🎯 Success Metrics

| Metric | Target |
|--------|--------|
| Posts on time | 100% |
| Approval step followed | 100% |
| Notification within 2 min | 100% |
| Zero skipped steps | 100% |

---

**This workflow is LOCKED. Violating it breaks trust.**
