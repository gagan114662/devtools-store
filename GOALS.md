# GOALS

## Active Goals

### [MEDIUM] Improve error messages
- **ID:** error-msgs-002
- **Status:** pending
- **Progress:** 0%
- **Context:** Make error messages more user-friendly
- **Success Criteria:**
  - [ ] Error codes have human-readable descriptions
- **Subtasks:**
  - [ ] Add error code descriptions
  - [ ] Update error formatting
- **Blocked By:** None

## Completed Goals

### [DONE] Add rate limiting to WebSocket connections
- **ID:** rate-limit-ws-001
- **Completed:** 2026-02-05T20:10:51.487Z

## Configuration

```yaml
autonomous:
  enabled: true
  workInterval: 30m
  maxWorkDuration: 10m
  quietHours:
    start: 23:00
    end: 07:00
    timezone: user
  notifications:
    onComplete: true
    onBlocked: true
```
