# ThaiJuan Instagram Posting Workflow

**Version:** 1.0  
**Last Updated:** 2026-04-10  
**Status:** LOCKED - Do not modify without approval

---

## 🎯 TRUST RULES (Overarching Principles)

**These rules apply to ALL workflows:**

1. **Don't Skip Steps** — Follow workflows exactly as defined
2. **Don't Make Things Up** — If you don't know, say you don't know
3. **Don't Lie** — Be honest about mistakes immediately
4. **Test Things Properly** — Verify before reporting success
5. **Be Trustworthy** — Prioritize accuracy over speed

**File:** `/Users/fenton/.openclaw/workspace/TRUST-RULES.md`

**Violating these rules breaks trust. Trust is non-negotiable.**

---

## 📋 Complete Workflow (8 Steps)

### Step 1: Draft Content
- Define headline
- Define promotion/offer
- Write caption
- Write hashtags
- Define visual direction for Canva
- **Define scheduled time** (when should this post?)

### Step 2: Generate Canva Design
- Define headline
- Define promotion/offer
- Write caption
- Write hashtags
- Define visual direction for Canva

### Step 2: Generate Canva Design
- Use `mcporter call canva-mcp.generate-design`
- Select best candidate from results

### Step 3: Export & Upload to GitHub
- Convert design to editable: `canva-mcp.create-design-from-candidate`
- Export as PNG: `canva-mcp.export-design`
- Download PNG locally
- Upload to GitHub (stable URL for Instagram)

### Step 4: Show Preview for Approval
- Display Canva edit URL
- Display GitHub image URL
- Display full caption + hashtags
- **WAIT for explicit user approval**
- ⛔ DO NOT PROCEED without approval

### Step 5: Create Google Calendar Event
- Use `gog calendar create`
- Include: summary, time, caption, Canva edit link, image attachment
- Event serves as record + visual calendar

### Step 5b: Add to Scheduler (for future posts)
- **If post is for future time:** Add to `campaign-schedule.json`
- Set `scheduledTime` and `date`
- Set `posted: false`
- Cron will auto-post at the scheduled time
- **If post is immediate:** Skip to Step 6

### Step 6: Post to Instagram
- Use Instagram Graph API via `poster.js` or `test-post.js`
- Create media container
- Wait 5 seconds for processing
- Publish media
- Capture post ID

### Step 7: Notify User (Automatic)
- **Auto-poster writes to:** `notification-pending.json`
- **Heartbeat checker runs:** Every 2 minutes
- **Heartbeat reads notification** and alerts Juan
- **Includes:** Instagram post URL, post ID, headline, promotion
- **Confirms:** Post is live and on time

### Step 8: Update State
- Update `campaign-state.json`
- Log success in daily memory file

---

## ⚠️ Critical Rules

1. **NEVER skip Step 4 (Approval)** — Always wait for explicit user approval
2. **NEVER post without approval** — This is the hard rule
3. **ALWAYS notify after posting** — Step 7 is mandatory
4. **If anything breaks, alert immediately** — Don't silently fail
5. **Follow all 8 steps in order** — No shortcuts

---

## 🚨 If Something Breaks

**Stop immediately and notify Juan with:**
- What step failed
- Error message/details
- What was attempted
- Suggested fix

**Do NOT:**
- Skip the broken step
- Continue without notifying
- Assume it's fine

---

## 🔐 Token Management

### Auto-Refresh System

**Script:** `auto-refresh-token.js`  
**Schedule:** Every 3 hours (cron: `0 */3 * * *`)  
**Log:** `/tmp/thaijuan-token-refresh.log`

**How it works:**
1. Checks current token expiry time
2. If expires in < 30 minutes → refreshes automatically
3. Updates `~/.mcporter/credentials.json` with new tokens
4. Logs success/failure

**Manual refresh (if needed):**
```bash
mcporter auth canva-mcp --reset
mcporter auth canva-mcp
```

**Token lifespan:**
- Access token: 3.5 hours (12,600 seconds)
- Refresh token: ~1 year (Canva-managed)
- Auto-refresh: Runs every 3 hours (proactive)

---

## 📁 Key Files

- `campaign-schedule.json` — 7-day campaign schedule
- `campaign-state.json` — Posting progress tracker
- `config.json` — Instagram API credentials (in `../../instagram-automation/`)
- `poster.js` — Auto-poster script
- `test-post.js` — Manual test posting script

---

## 🔧 System Components

| Component | Status | Notes |
|-----------|--------|-------|
| Canva MCP | ✅ | Design generation via MCP |
| GitHub | ✅ | Stable image hosting |
| Instagram Graph API | ✅ | Posting via Facebook API |
| Google Calendar | ✅ | Events with image attachments |
| Cron | ✅ | Auto-posting every minute |
| **Token Auto-Refresh** | ✅ | Refreshes OAuth tokens every 3 hours |

---

**This workflow is LOCKED.** Do not modify without explicit approval from Juan.
