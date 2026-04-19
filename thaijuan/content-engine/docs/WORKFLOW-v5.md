# ThaiJuan Instagram Automation - System v5.0

**Status:** Production Ready  
**Last Updated:** 2026-04-19  
**Location:** `/workspace/thaijuan/content-engine/`

---

## 🧹 System Cleanup & Reorganization
We have consolidated the ThaiJuan system into a single, focused directory: `/workspace/thaijuan/`. 
- **Removed:** The redundant `instagram-automation` folder and unused `thai-restaurant` root-level scripts.
- **Optimized:** Notification logic is now embedded directly in `instagram-poster.js` for 99% reliability.
- **Simplified:** Removed unused heartbeat and analytics cron jobs to reduce system "noise."

---

## 📂 Folder Structure

```
thaijuan/
└── content-engine/
    ├── src/
    │   └── instagram-poster.js    # The Core Engine (Post + Notify)
    ├── config/
    │   ├── config.json            # Instagram API Credentials
    │   ├── campaign-schedule.json # Your content calendar
    │   └── campaign-state.json    # Tracks the last post for continuity
    ├── designs/                   # Current campaign assets
    ├── designs/archive/           # Archived designs for reference
    └── docs/                      # Documentation
```

---

## ⚙️ Cron Configuration
**Runs every minute:**
`* * * * * cd ~/workspace/thaijuan/content-engine && node src/instagram-poster.js`

## 🚀 The 6-Step Workflow

### 1. Draft Content
I'll help you brainstorm the Headline, Promotion, and Caption based on your marketing goals.

### 2. Generate Design (Canva MCP)
We use the Canva integration to generate the visual asset based on your approved draft.

### 3. Prepare & Upload
The design is exported as a PNG and committed to your GitHub repository (`thaijuan-instagram-designs`) for a stable, high-speed URL.

### 4. Schedule It
I add the post details and the GitHub URL to `campaign-schedule.json`.

### 5. Approval
You give the final "Go" signal.

### 6. Auto-Pilot
- The cron job checks the schedule every minute.
- At the exact minute, it posts to Instagram via the Graph API.
- Within seconds, you receive a Discord notification with the live link.

---

## 🛠️ Maintenance & Troubleshooting

**Check Live Logs:**
`tail -f /tmp/thaijuan-instagram.log`

**Check Schedule Status:**
`cat content-engine/config/campaign-schedule.json | grep -A 2 "posted"`

**Manual Test Run:**
`cd content-engine && node src/instagram-poster.js`

**Important:** If you move files or rename folders, you **must** update the crontab with the new path.
