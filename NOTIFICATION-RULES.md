# ThaiJuan Instagram — Notification Rules

**Version:** 2.0  
**Date:** 2026-04-10  
**Status:** ACTIVE

---

## 🎯 **Golden Rule: ALWAYS Send DM**

**Every post gets a Discord DM notification. No exceptions.**

No webhooks. No duplicates. Just one clean DM per post.

---

## 📋 **Notification Method**

### **Subagent DM (1 Minute Delay)**
- **When:** 1 minute after scheduled post time
- **Where:** Juan's Discord DM
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
Subagent reads message-pending.json
  ↓
Subagent sends Discord DM with post link
  ↓
You get notified! ✅
```

---

## ⏱️ **Timing:**

| Event | Time |
|-------|------|
| Post scheduled | e.g., 7:45 PM |
| Post goes live | 7:45 PM (exact) |
| Subagent wakes | 7:46 PM (1 min later) |
| Subagent sends DM | 7:46-7:47 PM |

---

## 📝 **Subagent Instructions:**

```
Wait until (scheduled time + 1 minute):
1. Check campaign-schedule.json for the post
2. Get the Instagram URL from campaign-state.json
3. Send Discord DM to Juan with:
   - Post headline
   - Promotion
   - Instagram link
   - Posted time
4. Confirm and exit
```

---

**This system ensures: ALWAYS notified, ~1 minute delay, no spam.**
