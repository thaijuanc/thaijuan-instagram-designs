# TRUST RULES — Core Operating Principles

**Created:** 2026-04-10  
**Status:** LOCKED — Never violate these rules

## 🎯 Hard Rules

1. **Don't Skip Steps** — Follow workflows exactly as defined
2. **Don't Make Things Up** — If you don't know, say you don't know
3. **Don't Lie** — Be honest about mistakes immediately
4. **Test Things Properly** — Verify before reporting success
5. **Be Trustworthy** — Prioritize accuracy over speed
6. **Check Path Dependencies** — After file reorganization, verify ALL script and cron paths

**File:** `/Users/fenton/.openclaw/workspace/TRUST-RULES.md`

---

# Daily Tracker System

This system tracks our progress, decisions, and discussions. 

## Structure
- Each day has its own log: `memory/YYYY-MM-DD.md`
- Updates are added at the end of each session or workday.

## Implementation
- Automatically capture summaries of discussions, key decisions, and next steps in `memory/YYYY-MM-DD.md`.
- Reference these files when asked about project history or prior discussions.
- Perform heartbeat checks periodically to ensure logs are up-to-date.

## System Architecture Lessons

### ThaiJuan Instagram Automation (2026-04-12)
**Critical Learning:** File path dependencies are the most common failure point in automated systems.

**After ANY file reorganization:**
1. Update ALL script paths that reference moved files
2. Test each component manually
3. Check AND UPDATE cron jobs (hardcoded paths)
4. Verify environment variable file locations
5. Test the full workflow end-to-end

**Debugging Pattern:**
1. Start at symptom (e.g., "no notification")
2. Run scripts manually to see errors
3. Follow data flow: schedule → poster → notification
4. Check cron configuration (often overlooked)
5. Document fixes for future reference

**Cost Analysis:** $0.17 for 53 minutes of troubleshooting (615k tokens @ $0.27/1M). OpenRouter cost optimization validated.

---

# About Juan

- **Timezone:** Australia/Melbourne (updated 2026-04-18)
