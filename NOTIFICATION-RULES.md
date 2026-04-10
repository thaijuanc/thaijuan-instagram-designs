# ThaiJuan Instagram — Notification Rules

**Version:** 3.0  
**Date:** 2026-04-10  
**Status:** ACTIVE

---

## 🎯 **Golden Rule: Main Agent Sends DM**

**Every post gets a Discord DM notification from the main agent.**

Subagents can't send messages — only the main agent can.

---

## 📋 **Notification Method**

### **Main Agent DM (1 Minute Delay)**
- **When:** 1 minute after scheduled post time
- **Where:** Juan's Discord DM (via sessions_send)
- **Timing:** ~1 minute delay
- **Status:** ✅ Active and working

---

## 🔀 **How It Works:**

```
Post goes live (e.g., 7:45 PM)
  ↓
instagram-poster.js writes to message-pending.json
  ↓
Subagent wakes at 7:46 PM (1 minute later)
  ↓
Subagent reads message-pending.json + campaign-state.json
  ↓
Subagent writes to discord-notification-pending.json
  ↓
Main agent checks discord-notification-pending.json
  ↓
Main agent sends Discord DM via sessions_send
  ↓
You get notified! ✅
```

---

## ⏱️ **Timing:**

| Event | Time |
|-------|------|
| Post scheduled | e.g., 7:45 PM |
| Post goes live | 7:45 PM (exact) |
| Subagent prepares notification | 7:46 PM (1 min later) |
| Main agent sends DM | Next conversation start |

---

## 📝 **Main Agent Responsibility:**

**At the START of EVERY conversation:**
1. Check: `cat discord-notification-pending.json`
2. If exists → Use `sessions_send` to send to Juan
3. Delete file after sending
4. Continue with conversation

---

## 📁 **File Locations:**

| File | Purpose |
|------|---------|
| `message-pending.json` | Raw notification from instagram-poster.js |
| `discord-notification-pending.json` | Formatted for main agent to send |

---

**This system ensures: ALWAYS notified, main agent sends DM, no spam.**
