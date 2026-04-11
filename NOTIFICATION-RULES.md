# ThaiJuan Instagram — Notification Rules

**Version:** 4.0 (Webhook)  
**Date:** 2026-04-11  
**Status:** ACTIVE

---

## 🎯 **Golden Rule: Fully Automatic Discord Webhook**

**Every post gets an automatic Discord DM notification within 1 minute.**

No agent monitoring required — the webhook handles everything.

---

## 📋 **Notification Method**

### **Discord Webhook (1 Minute Delay)**
- **When:** 1 minute after post goes live
- **Where:** Juan's Discord server/channel via webhook
- **Timing:** ~1 minute delay
- **Status:** ✅ Active and working

---

## 🔀 **How It Works:**

```
Post goes live (e.g., 1:00 PM)
  ↓
instagram-poster.js writes to message-pending.json
  ↓
notify-juan.js detects it (within 1 minute)
  ↓
notify-juan.js sends Discord webhook
  ↓
You get notified! ✅
```

---

## ⏱️ **Timing:**

| Event | Time |
|-------|------|
| Post scheduled | e.g., 1:00 PM |
| Post goes live | 1:00 PM (exact) |
| notify-juan.js detects | 1:01 PM (within 1 min) |
| Discord webhook sent | 1:01 PM |
| You receive DM | 1:01 PM |

---

## 📁 **File Locations:**

| File | Purpose |
|------|---------|
| `message-pending.json` | Raw notification from instagram-poster.js |
| `notifications-sent/` | Archive of all sent notifications |
| `.env` | Discord webhook URL (SECRET) |

---

## 🔧 **Scripts:**

| Script | Purpose | Cron |
|--------|---------|------|
| `instagram-poster.js` | Posts to Instagram, writes message-pending.json | Every minute |
| `notify-juan.js` | Reads message-pending.json, sends Discord webhook | Every minute |
| `heartbeat-check.js` | Legacy detector (backup) | Every minute |

---

## 🛡️ **Webhook Security:**

- Webhook URL stored in `.env` (never committed to git)
- Only sends after successful Instagram post
- Archives all sent notifications
- Logs to `/tmp/thaijuan-notify-juan.log`

---

## ⚠️ **If Notification Fails:**

**Check logs:**
```bash
tail /tmp/thaijuan-notify-juan.log
```

**Test webhook:**
```bash
node notify-juan.js
```

**Verify webhook URL:**
```bash
cat .env
```

---

**This system ensures: ALWAYS notified, fully automatic, no manual monitoring.**
