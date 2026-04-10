# Heartbeat Configuration for ThaiJuan Instagram System

## Heartbeat Schedule: Every 10 minutes

## Tasks to Run Every Heartbeat:

### 1. Check for Pending Notifications
**Script:** `/Users/fenton/.openclaw/workspace/thai-restaurant/content-engine/heartbeat-check.js`

**Command:**
```bash
/Users/fenton/.nvm/versions/node/v22.22.2/bin/node /Users/fenton/.openclaw/workspace/thai-restaurant/content-engine/heartbeat-check.js
```

**If notifications found:**
- Send user a message with notification details
- Format:
```
📱 Instagram Post Published!

✅ Headline: [headline]
🎯 Promotion: [promotion]
📌 Post ID: [postId]
🔗 View: https://instagram.com/thaijuanc

Posted at [timestamp]
```

### 2. Check Campaign Status (Optional)
**File:** `campaign-state.json`

**Report if asked:**
- Current day/next post
- Posts remaining
- Campaign completion status

### 3. Check for Errors
**File:** `/tmp/thaijuan-instagram.log`

**Alert user if:**
- "ERROR" found in last 10 lines
- Auto-poster failed

---

## Cron Configuration:

```bash
# Auto-poster - runs every minute
* * * * * cd /Users/fenton/.openclaw/workspace/thai-restaurant/content-engine && /Users/fenton/.nvm/versions/node/v22.22.2/bin/node auto-poster.js >> /tmp/thaijuan-instagram.log 2>&1

# Heartbeat notification check - runs every 10 minutes
*/10 * * * * cd /Users/fenton/.openclaw/workspace/thai-restaurant/content-engine && /Users/fenton/.nvm/versions/node/v22.22.2/bin/node heartbeat-check.js >> /tmp/thaijuan-heartbeat.log 2>&1
```

---

## Notification Flow:

1. Auto-poster publishes post → Creates `notification-pending.json`
2. Heartbeat runs (every 10 min) → Runs `heartbeat-check.js`
3. heartbeat-check.js finds notification → Outputs to log
4. **I read the log during next heartbeat** → Send message to user
5. Notification file cleared → Ready for next

---

## Testing:

**Test command:**
```bash
/Users/fenton/.nvm/versions/node/v22.22.2/bin/node /Users/fenton/.openclaw/workspace/thai-restaurant/content-engine/heartbeat-check.js
```

**Expected output when notification exists:**
```
=== NOTIFICATION READY ===
TYPE: post_published
HEADLINE: [headline]
PROMOTION: [promotion]
POST_ID: [post_id]
MESSAGE: [message]
==========================
```

**Expected output when no notifications:**
```
No pending notifications
```
