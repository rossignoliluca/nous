# Trust Recalibration - Implementation Plan

## Changes Implemented in metrics_v2.ts

### 1. Minimum Window: 30 Operations

**Before:**
```typescript
// Trust calculated immediately from first operation
Math.min(1, metrics.loopFreeSteps / 50)  // 3 ops = 6% trust
```

**After:**
```typescript
const hasMinimumData = metrics.toolCallsTotal >= 30;

if (!hasMinimumData) {
  return { trust: 0, ... };  // No trust until 30 operations
}
```

**Impact:**
- First 30 operations: trust = 0%
- After 30: trust calculated based on performance
- Prevents trust inflation from small samples

---

### 2. EMA Smoothing

**Before:**
```typescript
const trust = trustFactors.reduce((a, b) => a * b, 1);  // Raw calculation
```

**After:**
```typescript
const trust_calculated = trust_base * penalties * bonuses;

// EMA smoothing
const trust = EMA_ALPHA * trust_calculated + (1 - EMA_ALPHA) * metrics.trustEMA;

// alpha = 0.15 means:
// - New value contributes 15%
// - Previous value contributes 85%
```

**Impact:**
- Trust changes gradually, not instantly
- Resistant to single-operation spikes
- Requires sustained performance to increase

---

### 3. Split Trust: Readonly / Write / Core

**Before:**
```typescript
// All operations treated equally
const trust = toolValidityRate * penalties * bonuses;
```

**After:**
```typescript
// Track by risk level
readonlyCallsValid / readonlyCallsTotal  // Easy operations
writeCallsValid / writeCallsTotal        // Medium risk
coreCallsValid / coreCallsTotal          // High risk

// Weighted average
trust_overall = (
  trust_readonly * 0.2 +  // Low weight
  trust_write * 0.3 +     // Medium weight
  trust_core * 0.5        // High weight
);
```

**Impact:**
- 100 perfect read_file = only 20% contribution
- 10 perfect modify_self_config = 50% contribution
- Trust reflects ACTUAL risk taken, not just volume

---

### 4. Persistent Loop History

**Before:**
```typescript
// agent.ts:816 - Local to function
const toolCallHistory: Array<...> = [];  // Reset every call
```

**After:**
```typescript
// Stored in data/loop_history.json
function recordToolCallInLoopHistory(tool, params, outcome) {
  const history = loadLoopHistory();  // Persistent
  history.push({ tool, params, outcome, timestamp });
  saveLoopHistory(history);
}

// Check across invocations
const recentWindow = history.slice(-10);
const matches = recentWindow.filter(...);
if (matches.length >= 3) {
  // ERR_LOOP_OPERATIONAL
}
```

**Impact:**
- Loops detected even across multiple agent calls
- History persists between sessions
- More reliable loop detection

---

## Comparison: Old vs New

### Scenario: 12 Read-Only Operations (No Errors)

**Old System:**
```
operations = 12
loopFreeSteps = 12
trust_factor = 12 / 50 = 0.24

trust = 1.0 * 1.0 * 1.0 * 1.0 * 0.24 = 24%
```

**New System (V2):**
```
operations = 12
hasMinimumData = false (< 30)

trust = 0%  (insufficient data)
```

---

### Scenario: 50 Operations (30 readonly, 15 write, 5 core) - All Valid

**Old System:**
```
loopFreeSteps = 50
trust_factor = 50 / 50 = 1.0

trust = 1.0 * 1.0 * 1.0 * 1.0 * 1.0 = 100%
```

**New System (V2):**
```
trust_readonly = 30/30 = 1.0
trust_write = 15/15 = 1.0
trust_core = 5/5 = 1.0

trust_base = 1.0 * 0.2 + 1.0 * 0.3 + 1.0 * 0.5 = 1.0
trust_calculated = 1.0 * (penalties) * (bonuses) ≈ 0.5  (slower scaling)

// First calculation
trust = 0.15 * 0.5 + 0.85 * 0 = 0.075 = 7.5%

// After 10 more perfect windows
trust ≈ 40% (EMA converges slowly)
```

---

### Scenario: 100 Read-Only, 1 Failed Core Operation

**Old System:**
```
trust = high (core failure doesn't weigh much)
```

**New System (V2):**
```
trust_readonly = 100/100 = 1.0  (contributes 20%)
trust_core = 0/1 = 0.0           (contributes 50%)

trust_base = 1.0 * 0.2 + 1.0 * 0.3 + 0.0 * 0.5 = 0.5

trust_overall ≈ 25%  (core failure has major impact)
```

---

## Migration Strategy

### Option A: Gradual Migration (Recommended)

1. Keep both metrics.ts and metrics_v2.ts
2. Run both in parallel (different files)
3. Compare outputs for 100 operations
4. Switch when V2 is validated

### Option B: Direct Migration

1. Replace metrics.ts with metrics_v2.ts
2. Reset metrics to zero (clean slate)
3. Rebuild trust from scratch

**Recommend: Option A** for safety.

---

## Integration Checklist

- [ ] Add metrics_v2.ts to src/core/
- [ ] Update agent.ts to use recordToolCallValid(riskLevel)
- [ ] Update agent.ts to use persistent loop history
- [ ] Update src/index.ts to add "nous metrics-v2" command
- [ ] Test with parallel runs (V1 vs V2)
- [ ] After validation, replace metrics.ts with metrics_v2.ts

---

## Risk Level Classification

**Readonly:**
- read_file
- list_files
- grep/search
- run_command (read-only queries: ls, cat, git status)

**Write:**
- write_file
- run_command (mutations: git commit, npm install, mkdir)

**Core:**
- modify_self_config
- Any operation followed by test validation
- Any operation that triggers rollback

---

## Expected Trust Trajectory (V2)

```
Operations 0-29:    trust = 0%          (insufficient data)
Operations 30-50:   trust = 0-10%       (slow EMA ramp-up)
Operations 50-100:  trust = 10-25%      (building evidence)
Operations 100-200: trust = 25-45%      (sustained performance)
Operations 200-500: trust = 45-70%      (proven reliability)
Operations 500+:    trust = 70-90%      (earned mastery)
```

**Trust > 90%** requires:
- 500+ operations
- Near-perfect validity rate
- Mix of readonly/write/core operations
- Zero loops, minimal errors
- Sustained over time (EMA smoothing)

---

## Validation Tests

1. **Cold start test:**
   - Run 10 operations
   - Verify trust = 0%

2. **Minimum window test:**
   - Run 30 operations
   - Verify trust starts calculating

3. **EMA test:**
   - Run 50 perfect operations
   - Verify trust < 20% (not instant 100%)

4. **Split trust test:**
   - 100 readonly, 0 core
   - Verify trust ≤ 20% (can't get higher without core ops)

5. **Loop history test:**
   - Call agent 3x with same params
   - Verify ERR_LOOP_OPERATIONAL across calls

---

## Verdict

**Old System:** Trust inflates too easily (24% after 12 ops)

**New System:** Trust earned slowly and meaningfully

**Philosophy:** "Trust is a record of sustained performance, not a reward for showing up."
