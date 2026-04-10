# ThaiJuan Instagram — Notification Rules

**Version:** 1.0  
**Date:** 2026-04-10  
**Status:** ACTIVE

---

## 🎯 **Golden Rule: ONE Notification Only**

**If one notification method succeeds, the other does NOT trigger.**

No duplicates. No spam. Just one clean notification per post.

---

## 📋 **Notification Methods**

### **Method 1: Discord Webhook (Instant)**
- **When:** Immediately after post goes live
- **Where:** Discord channel (requires webhook URL)
- **Timing:** Instant (same second as posting)
- **Status:** ⚠️ Requires Discord server channel

### **Method 2: Subagent DM (Delayed)**
- **When:** 2 minutes after scheduled post time
- **Where:** Juan's Discord DM
- **Timing:** 2-5 minute delay
- **Status:** ✅ Active and working

---

## 🔀 **How It Works:**

```
Post goes live (e.g., 6:30 PM)
  ↓
instagram-poster.js writes to message-pending.json
  ↓
instagram-poster.js sends Discord webhook (if configured)
  ↓
Sets: post.notificationSent = true
  ↓
Subagent wakes at 6:32 PM
  ↓
Subagent checks: Was notification already sent?
  ↓
If YES → Skip (no duplicate)
If NO → Send Discord DM
```

---

## ✅ **Preventing Duplicates:**

### **In instagram-poster.js:**

After sending webhook:
```javascript
post.notificationSent = true;
```

### **In Subagent Instructions:**

```
Before sending notification:
1. Check campaign-schedule.json
2. Look for post.notificationSent flag
3. If true → SKIP (already notified)
4. If false → Send Discord DM
```

---

## 📊 **Current Configuration:**

| Method | Enabled | Notes |
|--------|---------|-------|
| Discord Webhook | ⚠️ Configured but needs webhook URL | Instant if URL is set |
| Subagent DM | ✅ Active | 2-5 min delay, always works |

---

## 🎯 **Expected Behavior:**

**With Discord webhook URL configured:**
- Post goes live → Webhook fires instantly ✅
- Subagent wakes → Sees `notificationSent = true` → Skips ✅
- **Result:** 1 notification (instant)

**Without Discord webhook URL:**
- Post goes live → Webhook fails silently
- Subagent wakes → Sees `notificationSent = false` → Sends DM ✅
- **Result:** 1 notification (2-5 min delay)

---

## ⏱️ **Timing:**

| Event | Time |
|-------|------|
| Post scheduled | e.g., 6:30 PM |
| Post goes live | 6:30 PM (exact) |
| Webhook fires | 6:30:01 PM (instant) |
| Subagent wakes | 6:32 PM (2 min later) |
| Subagent sends DM | 6:32-6:35 PM (if webhook didn't fire) |

---

**This system ensures: ONE notification, no duplicates, no spam.**
