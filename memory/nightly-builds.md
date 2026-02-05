# Nightly Builds Log

## 2026-01-31 — Heartbeat Cost Optimization Plan

**Source Tweet**: https://x.com/OpenRouterAI/status/2017742972163445070
> 🦞 Important tip for @openclaw users: you should not be sending simple heartbeat requests to Opus! Use the Auto Router to automatically send them to very cheap (even free!) models.

**Also referenced**: https://x.com/BenjaminDEKR/status/2017660150463582282
> Made some adjustments based on lessons learned. Combined: roughly 200-400x cheaper heartbeat operation.

### Ideas Found (from X "For You" feed)

1. **Heartbeat Cost Optimization** (OpenRouter + Benjamin De Kraker)
   - Use cheap/free models for heartbeat polling
   - Leverage: HIGH | Safety: HIGH | Size: TINY (config only)

2. **Claude Code Tips** (Boris Cherny @bcherny)
   - Tips from the Claude Code creator
   - Leverage: MEDIUM | Requires: workflow changes

3. **Mission Control Multi-Agent** (Bhanu Teja P @pbteja1998)
   - 10 AI agents working as a team
   - Leverage: HIGH but Size: LARGE

4. **Claude Cowork Plugins** (@claudeai)
   - Bundle skills/connectors into specialist plugins
   - Leverage: MEDIUM | Size: MEDIUM

5. **Local AI-as-a-Service** (@aiedge_)
   - Business model for teaching AI tools
   - Not directly applicable

### Selected: Heartbeat Cost Optimization

**Status**: ⚠️ PLAN ONLY (config has validation issues, cannot auto-apply)

**Current State**:
- `HEARTBEAT.md` is empty → heartbeats already being skipped (good!)
- No `heartbeat.model` configured → when enabled, would use expensive default model
- Config has pre-existing validation issues (experimental features)

### Ready-to-Apply Config

Add this to `agents.defaults.heartbeat` when config validation is fixed:

```json5
{
  "agents": {
    "defaults": {
      "heartbeat": {
        "model": "openrouter/meta-llama/llama-3.3-70b-instruct:free",
        "every": "30m",
        "thinking": "off"
      }
    }
  }
}
```

**Why this matters**:
- Heartbeats run every 30m by default
- Using Opus: ~$0.015-0.075 per heartbeat (depending on context size)
- Using Llama 3.3 70B free: $0.00
- Savings: ~$20-50/month for always-on agent

### Config Validation Issues to Fix First

From `gateway config.get`:
1. `auth.profiles.openrouter:free.mode` - Invalid input
2. `agents.defaults.model` - Unrecognized keys: "rateLimitFallback", "onRateLimit"
3. `agents.defaults.feedbackLoop.review` - Unrecognized keys
4. `agents.defaults.feedbackLoop.preflight` - Unrecognized key
5. `hooks.internal.entries.block-at-commit` - Unrecognized keys

These are likely experimental features. Options:
- Remove the experimental keys
- Or wait for schema updates to support them

### Tests (when applied)

1. Run `openclaw status` to verify config loaded
2. Check heartbeat runs use the cheap model in logs
3. Add a task to HEARTBEAT.md and confirm it uses Llama 3.3

### Next Steps

- [ ] Fix config validation issues (or accept they're experimental)
- [ ] Apply heartbeat model config
- [ ] Consider per-cron-job model configs for routine tasks
