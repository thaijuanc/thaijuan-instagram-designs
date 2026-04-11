# ThaiJuan Instagram Workflow — SIMPLE VERSION

**Version:** 3.0 (Optimized)  
**Created:** 2026-04-10  
**Updated:** 2026-04-11  
**Status:** LOCKED — Never skip steps

---

## 🎯 TRUST RULES (Apply to ALL Workflows)

1. **Don't Skip Steps** — Follow exactly as defined
2. **Don't Make Things Up** — If you don't know, say so
3. **Don't Lie** — Honest about mistakes immediately
4. **Test Things Properly** — Verify before reporting success
5. **Be Trustworthy** — Accuracy > speed
6. **Learn From Mistakes** — Never repeat the same error
7. **Mobile-First Formatting** — No extra blank lines, no decorative dashes, compact scannable content
8. **Clear System Feedback** — Before EACH step, state what you're about to do + estimated time, THEN execute

**Files:** /Users/fenton/.openclaw/workspace/TRUST-RULES.md, /Users/fenton/.openclaw/workspace/memory/2026-04-10.md

---

## 📋 The 6-Step Workflow (Optimized)

### 📍 BEFORE STARTING: Show Full Plan
**When Juan says "create a post":**
1. Show the full workflow plan (Steps 1-6 with timing)
2. Show Step 1 draft (headline, promotion, caption, visual, scheduled time)
3. WAIT for approval before proceeding

---

### Step 1: Draft Content ⏱️ ~2 min
**What:** Define what you want to post

**Output:**
- Headline
- Promotion/offer
- Caption (with emojis + hashtags)
- **Canva MCP Prompt** (optimized text prompt for best design generation)
- Scheduled time

**🛑 WAIT FOR APPROVAL**
- Show full draft including Canva prompt to Juan
- **DO NOT proceed until Juan approves**

---

### Step 2+3: Generate, Export & Upload to GitHub ⏱️ ~1 min
**After Step 1 approval:**

**FEEDBACK FIRST:** Say "Generating design in Canva (~1 min)..." THEN execute

**IMPORTANT:** Run from workspace root (`/Users/fenton/.openclaw/workspace`)

**Commands:**
```bash
# Generate 1 design
cd /Users/fenton/.openclaw/workspace && mcporter call canva-mcp.generate-design --timeout 120000 --args '{"query": "[visual direction]","design_type": "instagram_post","user_intent": "[description]"}'

# Convert to editable (use first candidate)
mcporter call canva-mcp.create-design-from-candidate --args '{"job_id": "...","candidate_id": "[first candidate]","user_intent": "Convert to editable"}'

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
- 1 PNG file saved locally
- Committed to GitHub
- Stable GitHub URL ready for preview

**Note:** Canva tokens auto-refresh every 2 hours via cron. If auth fails, run `mcporter auth canva-mcp` once.

---

### Step 4: ⏸️ HARD CHECKPOINT — Show Preview & WAIT ⏱️ ∞
**FEEDBACK FIRST:** Say "Design ready! Showing preview for approval..." THEN show

**What:** Show Juan the design PNG (attached in Discord) and content, **WAIT FOR APPROVAL**

**Output to Juan:**
- **Attach PNG image** so it renders in Discord
- Show content summary
- Include GitHub URL and Canva edit URL as reference

**Format:**
```
## Step 4: Preview for Approval

### 📝 Content
**Headline:** [headline]
**Promotion:** [promotion]
**Caption:** [full caption]
**Scheduled Time:** [time]

### 🎨 Design
**GitHub:** [url]
**Canva Edit:** [url]

### ⏳ WAITING FOR YOUR APPROVAL
**Reply:** "yes" or "approve" to proceed
**I will NOT proceed without your approval.**
```

**HARD RULE:** 🛑 **STOP HERE. DO NOT PROCEED WITHOUT "YES".**

---

### Step 5: Add to Scheduler ⏱️ ~1 min
**FEEDBACK FIRST:** Say "Adding to scheduler and committing to GitHub (~1 min)..." THEN execute

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

### Step 6-8: Automatic (Cron Jobs)

**Step 6: Auto-Post at Scheduled Time**
- Cron runs `instagram-poster.js` every minute
- Scans schedule for posts where: date=today, time=now, posted=false
- Posts to Instagram automatically

**Step 7: Automatic Notification**
- After posting, script writes to `message-pending.json`
- Cron runs `notify-juan.js` every minute
- Sends Discord webhook → Juan gets DM with post link

**Step 8: Update State**
- Script updates `campaign-state.json`
- Records: lastPostDate, lastPostId, updatedAt

---

## 📁 File Structure

```
/Users/fenton/.openclaw/workspace/
├── TRUST-RULES.md
├── MEMORY.md
│
└── thai-restaurant/content-engine/
    ├── instagram-poster.js
    ├── heartbeat-check.js
    ├── notify-juan.js
    ├── campaign-schedule.json
    ├── campaign-state.json
    ├── SIMPLE-WORKFLOW.md
    └── [design files].png
```

---

## 🔧 Cron Configuration

```bash
* * * * * node instagram-poster.js
* * * * * node heartbeat-check.js
* * * * * node notify-juan.js
0 */2 * * * node auto-refresh-token.js
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

**This workflow is LOCKED. Violating it breaks trust.**
