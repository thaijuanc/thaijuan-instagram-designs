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

### Step 1: Draft Content ✍️
**Create the content brief:**
- Headline
- Promotion/offer details
- Full caption
- Hashtags
- Visual direction for Canva (style, colors, mood, key elements)
- Scheduled time (when should this post?)

**🛑 WAIT FOR APPROVAL**
- Show draft to user
- **DO NOT proceed until user approves the copy and visual direction**

### Step 2: Generate Canva Design 🎨
**After Step 1 approval:**
- Use `mcporter call canva-mcp.generate-design` with approved brief
- Review generated candidates
- Select best candidate (or ask user to pick)

### Step 3: Export & Upload to GitHub 📤
**Make design editable and export:**
- Convert to editable design: `canva-mcp.create-design-from-candidate`
- Export as PNG: `canva-mcp.export-design`
- Download PNG
- Upload to GitHub repository (stable URL for Instagram API)

### Step 4: Show Preview for Approval ✅
**Present complete preview:**
- Canva edit URL (for any last-minute tweaks)
- GitHub image URL (preview the actual image)
- Full caption + hashtags
- Scheduled post time

**🛑 WAIT FOR EXPLICIT APPROVAL**
- ⛔ DO NOT PROCEED without user saying "yes" or "approve"

### Step 5: Create Google Calendar Event 📅
**After Step 4 approval:**
- Use `gog calendar create`
- Include: event title, scheduled time, full caption, Canva edit link, image attachment
- Event serves as permanent record + visual calendar reference

### Step 6: Post to Instagram 📸
**For immediate posts:**
- Use Instagram Graph API via `poster.js` or `test-post.js`
- Create media container with GitHub image URL
- Wait 5 seconds for processing
- Publish media
- Capture and save post ID

**For scheduled posts:**
- Add to `campaign-schedule.json` with `scheduledTime`, `date`, `posted: false`
- Cron auto-posts at scheduled time (checks every minute)

### Step 7: Notify User 🔔
**Automatic notification after posting:**
- **Auto-poster writes to:** `message-pending.json`
- **notify-juan.js runs:** Every minute (cron)
- **Sends Discord webhook directly** → Juan gets DM within 1 minute
- **No agent monitoring required** — fully automatic!

### Step 8: Update State 📝
**Finalize:**
- Update `campaign-state.json` (mark as posted)
- Log success in daily memory file (`memory/YYYY-MM-DD.md`)

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
