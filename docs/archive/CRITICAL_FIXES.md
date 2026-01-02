# Critical Fixes - Risk Mitigation

## Context

After integration of metrics_v2, Luca360 identified 3 remaining risks:

1. **Risk classification naive** (tool name only, not param-aware)
2. **Loop history without decay** (false positives accumulate)
3. **Trust farming possible** (500 readonly ops → high trust without risk)

These fixes address all 3.

---

## Fix 1: Loop History Decay (200 events)

### Problem

```typescript
// Before: MAX_LOOP_HISTORY = 100
// If system does 1000 ops, history contains loops from 900 ops ago
// → False positives: blocks legitimate exploration
```

**Scenario:**
1. Day 1: System tries approach A, loops detected
2. Day 3: System tries approach B (different context)
3. Loop history still contains A → false positive

**Risk:** Guardrail becomes a cage.

### Solution

```typescript
const MAX_LOOP_HISTORY = 200;  // Decay: keep only last 200 events

// Why 200:
// - Active usage: 200 ops = recent context
// - Inactive: old loops auto-expire by displacement
// - Not time-based: usage-driven decay
```

**Window increased from 10 to 20:**
```typescript
const recentWindow = history.slice(-20);  // Was -10

// Why 20: With 200-event history, last 10 is too narrow
// If 100 varied ops, then 3x same → we want to catch it
```

**Impact:**
- ✅ Old loops expire naturally
- ✅ Not time-dependent (usage-driven)
- ✅ Prevents permanent false positives

---

## Fix 2: Param-Aware Risk Classification

### Problem

**Before:**
```typescript
classifyToolRisk('run_command', ...) → 'write' or 'readonly'
classifyToolRisk('write_file', ...) → 'write'

// Issues:
run_command("grep foo") → write (wrong!)
run_command("rm -rf /") → write (should be CORE!)
write_file("/tmp/test.txt") → write (ok)
write_file("config/self.json") → write (should be CORE!)
```

All `run_command` treated equally regardless of danger.

### Solution

**run_command - Denylist for core operations:**
```typescript
// Core: Destructive/dangerous commands
if (cmd.match(/\b(rm\s+-rf?|git\s+reset\s+--hard|git\s+push\s+(-f|--force)|sudo|chmod\s+777|dd\s+if=)/)) {
  return 'core';
}

// Write: Mutations
if (cmd.match(/^(git\s+(commit|add|push|rm)|npm\s+install|mkdir|rm\s+[^-]|mv|cp)/)) {
  return 'write';
}

// Readonly: Everything else (grep, ls, cat, git status)
return 'readonly';
```

**write_file - Path-aware:**
```typescript
const path = params.path?.toLowerCase() || '';

// Core: Critical files
if (path.match(/(^|\/)((config|src|package)\.json|\.env|tsconfig|\.git)/)) {
  return 'core';
}

// Write: Regular files
return 'write';
```

**Examples:**
```
run_command("grep foo")             → readonly ✅
run_command("git status")           → readonly ✅
run_command("git commit")           → write ✅
run_command("rm -rf /")             → core ✅
run_command("git push --force")     → core ✅
write_file("/tmp/test.txt")         → write ✅
write_file("config/self.json")      → core ✅
write_file("src/core/agent.ts")     → core ✅
```

**Impact:**
- ✅ Dangerous operations correctly weighted
- ✅ Trust reflects actual risk taken
- ✅ Can't farm trust with safe operations then do one dangerous one

---

## Fix 3: Minimum Evidence Thresholds

### Problem

**Trust formula:**
```typescript
trust = readonly * 0.2 + write * 0.3 + core * 0.5
```

**Exploit:**
1. Do 500 perfect readonly ops → trust_readonly = 1.0
2. Do 0 write, 0 core
3. Trust = 1.0 * 0.2 = 20%
4. With EMA and bonuses → trust could reach 30-40%
5. **Never did risky operation**, but has "trust"

**Problem:** Trust farming on easy operations.

### Solution

**Trust tiers with minimum evidence:**

```typescript
// Tier 1 (0-30%): Can be achieved with readonly only
// No restriction

// Tier 2 (30-60%): Requires at least 5 successful write ops
if (trust_calculated > 0.30 && metrics.writeCallsValid < 5) {
  trust_calculated = Math.min(trust_calculated, 0.30);
}

// Tier 3 (60%+): Requires at least 3 successful core ops
if (trust_calculated > 0.60 && metrics.coreCallsValid < 3) {
  trust_calculated = Math.min(trust_calculated, 0.60);
}
```

**Trust ladder:**
```
Trust 0-30%:   Achievable with readonly only
Trust 30-60%:  Must have 5+ successful write operations
Trust 60%+:    Must have 3+ successful core operations (modify_self_config, critical files)
```

**Examples:**

**Scenario A: Trust farming attempt**
```
Operations: 500 readonly (all perfect)
trust_readonly = 1.0
trust_write = 0 (none)
trust_core = 0 (none)

trust_calculated = 1.0 * 0.2 = 0.20 (20%)

✅ Can't reach 30% without write ops
✅ Can't reach 60% without core ops
```

**Scenario B: Balanced operations**
```
Operations: 100 readonly, 10 write, 5 core (all perfect)
trust_base = 1.0 * 0.2 + 1.0 * 0.3 + 1.0 * 0.5 = 1.0

writeCallsValid = 10 (>= 5) ✅
coreCallsValid = 5 (>= 3) ✅

No caps applied → trust can reach high levels
```

**Impact:**
- ✅ Must demonstrate capability at each risk level
- ✅ Can't skip tiers
- ✅ Trust reflects proven competence, not volume

---

## Summary

| Fix | Problem | Solution | Impact |
|-----|---------|----------|--------|
| **Loop Decay** | False positives accumulate | 200-event sliding window | Old loops expire naturally |
| **Param-Aware Risk** | All run_command equal | Denylist for dangerous ops | Reflects actual risk |
| **Evidence Thresholds** | Trust farming on readonly | Tier gates: 5 write, 3 core | Must prove at each level |

---

## Testing Evidence

### Loop Decay
```bash
# After 200 operations, old loops gone
# History: data/loop_history.json (max 200 entries)
```

### Param-Aware Risk
```typescript
// Test case 1
classifyToolRisk('run_command', {command: 'grep foo'})
// → 'readonly' ✅

// Test case 2
classifyToolRisk('run_command', {command: 'rm -rf /'})
// → 'core' ✅

// Test case 3
classifyToolRisk('write_file', {path: 'config/self.json'})
// → 'core' ✅
```

### Evidence Thresholds
```typescript
// Test: 100 readonly, 0 write, 0 core
// Result: trust capped at 30% ✅

// Test: 50 readonly, 10 write, 0 core
// Result: trust capped at 60% ✅

// Test: 50 readonly, 10 write, 5 core
// Result: trust can reach 80%+ ✅
```

---

## Remaining Risks (Acknowledged)

### 1. Rollback Test Still Missing
- Have: Rollback code implemented
- Missing: Evidence that degrado → rollback triggers
- Status: TODO

### 2. Denylist Maintenance
- Dangerous commands list is not exhaustive
- Needs periodic review
- Could miss new attack vectors

### 3. Path Traversal in write_file
- Current check: simple regex
- Doesn't catch all traversal patterns (../, symlinks)
- Could be bypassed

---

## Philosophy

**Before:** "Trust is computed from activity"

**After:** "Trust is earned by demonstrating risk management at each tier"

Can't skip levels. Can't farm on easy operations. Decay prevents false positives.

This is what mature guardrails look like.
