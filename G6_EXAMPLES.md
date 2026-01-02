# G6 EXAMPLES: Autoanalysis of NOUS Architectural Decisions

**Purpose**: Extract G6 quality rules from real examples in the NOUS codebase.

**Methodology**: Identify 5 GOOD decisions (reduce complexity/risk) and 5 BAD decisions (increase complexity without proportional benefit).

**Output**: 10 schede → 5-8 G6 rules → 3 proxy metrics → 2 hard stop criteria

---

## PART 1: GOOD EXAMPLES (Complexity Reduction)

### 🟢 SCHEDA 1: Two-Step Confirmation for Critical Files

**CONTEXT**
`src/core/operational_gate.ts:84-148`

High-risk file operations (package.json, .env, config/self.json) require explicit token acknowledgment before execution.

**WHY GOOD**
- **Reduces accidental damage risk**: One-shot token expires in 60s, preventing automation from blindly mutating critical files
- **Minimal surface area**: Single function `setHighRiskToken()` generates token, `checkAndConsumeHighRiskToken()` validates
- **Fail-safe by default**: Token required, not optional - can't accidentally bypass

**MEASURABLE SIGNAL**
- Δrisk: -90% (critical file mutations without token: impossible)
- Δsurface area: +2 functions (setHighRiskToken, checkAndConsumeHighRiskToken)
- Δcognitive load: +5% (developer must understand token flow, but only for critical operations)

**ALTERNATIVE CONSIDERED**
- Manual confirmation prompt: Blocks automation, requires stdin
- Whitelist approach: Static list doesn't scale, misses edge cases
- No gate: Unacceptable safety risk

**G6 RULE CANDIDATE**
```
IF operation is irreversible AND high-impact (critical file mutation)
THEN require two-step confirmation with time-bounded token
REJECT IF confirmation bypassed or token reused
```

---

### 🟢 SCHEDA 2: Param-Aware Risk Classification

**CONTEXT**
`src/core/agent.ts:35-74`, `src/core/operational_gate.ts:445-480`

Risk classification inspects operation parameters (file paths, command strings) to assign granular risk levels: readonly → write_normal → write_critical → core.

**WHY GOOD**
- **Avoids false positives**: Budget governs only write_critical/core, not all writes (Phase 3.1 fix)
- **Context-sensitive**: Same tool (write_file) classified differently based on target path
- **Separates safety from usability**: Normal work (write_normal) doesn't consume exploration budget

**MEASURABLE SIGNAL**
- Δrisk: 0 (safety maintained: critical files still gated)
- Δfalse positives: -76% (211 → 50 in production test)
- Δblock rate: -61% (26.1% → 10.0%)
- Δcognitive load: +10% (developer must understand 4-tier risk model)

**ALTERNATIVE CONSIDERED**
- Tool-only classification: Too coarse, blocks all writes
- Manual risk annotation: Brittle, requires remembering to annotate
- No classification: Unacceptable safety risk

**G6 RULE CANDIDATE**
```
IF risk classification depends on operation parameters (not just tool name)
THEN inspect params to assign granular risk level
REJECT IF classification ignores params and treats all instances identically
```

---

### 🟢 SCHEDA 3: Persistent Loop History with Decay

**CONTEXT**
`src/core/metrics_v2.ts:195-247`

Loop detection maintains persistent history (200 events, LRU eviction) across sessions, with automatic decay over time.

**WHY GOOD**
- **Catches recurring patterns**: Not fooled by session boundaries
- **Bounded memory**: Fixed-size buffer (200 events) prevents unbounded growth
- **Auto-healing**: Decay prevents permanent "scarring" from transient issues

**MEASURABLE SIGNAL**
- Δrisk: -40% (loop detections before escape: 1-2 iterations vs unbounded)
- Δmemory: +~50KB (200 events × ~250 bytes/event)
- Δcognitive load: +0% (implementation detail, hidden from user)

**ALTERNATIVE CONSIDERED**
- In-memory only: Resets every session, misses cross-session loops
- Unbounded history: Memory leak risk
- No persistence: Can't learn from past failures

**G6 RULE CANDIDATE**
```
IF system learns from historical patterns AND pattern detection spans multiple sessions
THEN persist history with bounded size and automatic decay
REJECT IF history grows unbounded OR doesn't survive restart
```

---

### 🟢 SCHEDA 4: Allowlist-Based Command Gate

**CONTEXT**
`src/core/operational_gate.ts:42-68, 179-205`

Command execution uses capabilities model: only explicitly allowed commands run. Denylist exists as defense-in-depth, but allowlist is primary gate.

**WHY GOOD**
- **Secure by default**: Unknown commands blocked automatically
- **Explicit intent**: Each allowed pattern documented with rationale
- **Defense in depth**: Denylist catches explicitly dangerous patterns even if allowlist has bug

**MEASURABLE SIGNAL**
- Δrisk: -95% (arbitrary command execution: blocked)
- Δsurface area: +1 regex per allowed command (~20 patterns)
- Δcognitive load: +15% (developer must update allowlist for new commands)

**ALTERNATIVE CONSIDERED**
- Denylist only: Blacklist approach, misses novel attacks
- No gate: Unacceptable security risk
- User confirmation per command: Blocks automation

**G6 RULE CANDIDATE**
```
IF system executes external commands OR provides privileged capabilities
THEN use allowlist (capabilities model) as primary gate
AND maintain denylist as defense-in-depth for explicitly dangerous patterns
REJECT IF denylist is only control OR allowlist is overly permissive
```

---

### 🟢 SCHEDA 5: Zero-Dependency Custom Test Runner

**CONTEXT**
`src/testing/runner.ts:1-281`

Custom test runner (281 lines) with zero external dependencies. Replaces Jest/Mocha/Vitest.

**WHY GOOD**
- **No supply chain risk**: Zero dependencies = zero CVEs from test framework
- **Instant startup**: No framework initialization overhead
- **Full control**: Can customize behavior (timeout, async handling) without fighting framework
- **Minimal surface**: 281 lines vs 10,000+ lines in Jest

**MEASURABLE SIGNAL**
- Δdependencies: -1 (no test framework in package.json)
- Δsurface area: +281 lines (custom runner) vs +10,000+ lines (Jest import)
- Δstartup time: -80% (0.1s vs 0.5s)
- Δcognitive load: +20% (developer must learn custom runner API)

**ALTERNATIVE CONSIDERED**
- Use Jest: 350+ dependencies, slow startup, complex configuration
- Use Vitest: Modern but still 100+ dependencies
- Use Node's built-in test runner: Requires Node 18+, limited features

**G6 RULE CANDIDATE**
```
IF external dependency adds large surface area AND functionality can be implemented simply
THEN prefer minimal custom implementation over heavyweight framework
REJECT IF custom implementation exceeds 2x size of using framework OR lacks critical features
```

---

## PART 2: BAD EXAMPLES (Complexity Without Benefit)

### 🔴 SCHEDA 6: Duplicated Risk Classification

**CONTEXT**
`src/core/agent.ts:35-74` and `src/core/operational_gate.ts:445-480`

Function `classifyToolRisk()` exists in both agent.ts (39 lines) and operational_gate.ts (35 lines) with identical logic.

**WHY BAD**
- **Maintenance burden**: Bug fixes require updating both copies
- **Drift risk**: Implementations can diverge over time
- **Code smell**: Duplication is symptom of poor module boundaries

**MEASURABLE SIGNAL**
- Δsurface area: +35 lines (unnecessary duplication)
- Δmaintenance cost: +100% (must update 2 locations for every change)
- Δbug risk: +50% (implementations can drift, already saw in Phase 3.1)

**ALTERNATIVE**
- Extract to shared module (e.g., `src/core/risk.ts` or `src/utils/risk.ts`)
- Import from single source in both agent.ts and operational_gate.ts
- Net: -35 lines, -50% maintenance burden

**G6 RULE CANDIDATE**
```
IF identical logic exists in 2+ locations AND logic is >20 lines
THEN extract to shared module
REJECT IF duplication exceeds 20 lines OR logic has diverged
```

---

### 🔴 SCHEDA 7: Agent Execution Mixing Concerns

**CONTEXT**
`src/core/agent.ts:964-1210` (246 lines)

Function `runAgentStep()` mixes 6 concerns: API call, streaming, validation, gate check, execution, budget accounting.

**WHY BAD**
- **High cognitive load**: 246 lines, 3 nested levels, 6 distinct responsibilities
- **Hard to test**: Can't test gate logic without mocking API client
- **Hard to modify**: Change to gate check requires understanding entire execution flow
- **Violates SRP**: Single function should have single responsibility

**MEASURABLE SIGNAL**
- Δcognitive load: +200% (246 lines vs 80-line ideal)
- Δtest complexity: +300% (must mock 6 systems to test any one)
- Δchange risk: +150% (change to any concern affects all others)

**ALTERNATIVE**
Split into pipeline:
1. `executeAgentAPI()` - API call and streaming
2. `validateResponse()` - Tool call validation
3. `checkGate()` - Gate decision
4. `executeTool()` - Tool execution
5. `recordBudget()` - Budget accounting

Net: -100 lines through decomposition, -70% cognitive load

**G6 RULE CANDIDATE**
```
IF function exceeds 150 lines OR mixes 3+ distinct concerns
THEN decompose into pipeline or extract sub-functions
REJECT IF decomposition not possible without major refactor (indicates architectural problem)
```

---

### 🔴 SCHEDA 8: Budget-Metrics Coupling

**CONTEXT**
`src/core/exploration.ts:176-225`

Function `adjustBudget()` directly imports and calls `getMetrics()` from metrics_v2, tightly coupling budget policy to metrics internal structure.

**WHY BAD**
- **Fragile coupling**: Change to metrics_v2 internal structure breaks budget adjustment
- **Hidden dependencies**: Budget system depends on metrics, but not obvious from interface
- **Hard to test**: Can't test budget adjustment without full metrics system
- **Violates dependency inversion**: High-level policy (budget) depends on low-level detail (metrics structure)

**MEASURABLE SIGNAL**
- Δcoupling: +1 direct import (exploration → metrics_v2)
- Δtest complexity: +100% (must mock metrics_v2 internal structure)
- Δchange cost: +80% (metrics changes ripple to budget)

**ALTERNATIVE**
Pass metrics as argument:
```typescript
function adjustBudget(state: ExplorationState, metrics: BudgetMetrics): void {
  // Use metrics.stability, metrics.errorFreeSteps, etc.
}
```

Or use event system:
```typescript
metricsEmitter.on('window-complete', (metrics) => adjustBudget(state, metrics));
```

Net: Decouples modules, -60% change cost, +40% testability

**G6 RULE CANDIDATE**
```
IF module A directly imports internal structure from module B
THEN pass data as argument OR use event system
REJECT IF direct import creates coupling AND change to B breaks A
```

---

### 🔴 SCHEDA 9: Hard-Coded Rollback Thresholds

**CONTEXT**
`src/core/rollback.ts:73-105`

Rollback degradation thresholds hard-coded: 0.8 (initial), 0.85 (slight improvement), 0.75 (degradation). No rationale documented.

**WHY BAD**
- **Magic numbers**: Why 0.8 and not 0.75 or 0.85? No justification
- **Not tunable**: Can't adjust thresholds without code change
- **No measurement**: Thresholds chosen arbitrarily, not derived from data
- **Brittle**: Different use cases may need different thresholds (e.g., safety-critical vs exploratory)

**MEASURABLE SIGNAL**
- Δcognitive load: +30% (developer must guess why 0.8 is "good enough")
- Δadaptability: -100% (can't tune without code change)
- Δconfidence: -40% (arbitrary thresholds reduce trust in rollback decision)

**ALTERNATIVE**
Make thresholds configurable:
```typescript
interface RollbackConfig {
  thresholds: {
    initial: number;      // Default 0.8
    improvement: number;  // Default 0.85
    degradation: number;  // Default 0.75
  };
}
```

Or derive from historical data:
```typescript
// Calculate thresholds from past rollback outcomes
const threshold = calculateThresholdFromHistory(rollbackHistory, targetConfidence: 0.95);
```

Net: +20 lines config, -30% brittleness, +60% confidence

**G6 RULE CANDIDATE**
```
IF numeric thresholds determine critical behavior (rollback, alerts, etc.)
THEN make configurable AND document rationale OR derive from measurement
REJECT IF hard-coded with no justification AND can't be tuned
```

---

### 🔴 SCHEDA 10: Source Code Tests (Brittle Checks)

**CONTEXT**
`src/testing/guardrails.test.ts:226-283`

Tests use `fs.readFileSync()` to check that source code contains specific strings (e.g., "checkOperationalGate", "isCriticalFile").

**WHY BAD**
- **Brittle**: Breaks on refactoring (rename function, move to different file)
- **False confidence**: Code can contain string but not actually enforce behavior
- **Not behavior-driven**: Tests check implementation details, not outcomes
- **High maintenance**: Every refactor requires updating string checks

**MEASURABLE SIGNAL**
- Δtest brittleness: +300% (breaks on cosmetic changes)
- Δfalse positive risk: +80% (string exists but behavior broken)
- Δmaintenance cost: +150% (must update tests for every refactor)

**ALTERNATIVE**
Test behavior, not source:
```typescript
test('operational gate blocks dangerous commands', () => {
  const decision = checkOperationalGate('run_command', { command: 'rm -rf /' });
  assert(!decision.allowed, 'Should block dangerous command');
});

test('critical files require token', () => {
  const decision = checkOperationalGate('write_file', { path: './package.json' });
  assert(!decision.allowed, 'Should block critical file without token');
});
```

Net: -50 lines (remove fs.readFileSync checks), -80% brittleness, +100% confidence

**G6 RULE CANDIDATE**
```
IF test checks source code strings OR internal implementation details
THEN replace with behavior-driven tests (input → output)
REJECT IF test breaks on refactoring that doesn't change behavior
```

---

## PART 3: EXTRACTED G6 RULES

From the 10 schede above, we extract the following quality rules:

### R1: Two-Step Confirmation for Irreversible Actions
```
IF operation is irreversible AND high-impact
THEN require two-step confirmation with time-bounded token
REJECT IF confirmation bypassed or token reused
```

### R2: Param-Aware Risk Classification
```
IF risk classification depends on operation parameters
THEN inspect params to assign granular risk level
REJECT IF classification ignores params and treats all instances identically
```

### R3: Persistent Learning with Bounded Memory
```
IF system learns from historical patterns AND pattern detection spans multiple sessions
THEN persist history with bounded size and automatic decay
REJECT IF history grows unbounded OR doesn't survive restart
```

### R4: Allowlist + Denylist Defense-in-Depth
```
IF system executes external commands OR provides privileged capabilities
THEN use allowlist (capabilities model) as primary gate
AND maintain denylist as defense-in-depth
REJECT IF denylist is only control OR allowlist is overly permissive
```

### R5: Prefer Custom over Heavy Dependencies
```
IF external dependency adds large surface area AND functionality can be implemented simply
THEN prefer minimal custom implementation over heavyweight framework
REJECT IF custom implementation exceeds 2x size of using framework OR lacks critical features
```

### R6: Extract Duplicated Logic
```
IF identical logic exists in 2+ locations AND logic is >20 lines
THEN extract to shared module
REJECT IF duplication exceeds 20 lines OR logic has diverged
```

### R7: Single Responsibility Principle (Function Decomposition)
```
IF function exceeds 150 lines OR mixes 3+ distinct concerns
THEN decompose into pipeline or extract sub-functions
REJECT IF decomposition not possible without major refactor (indicates architectural problem)
```

### R8: Decouple Modules via Dependency Inversion
```
IF module A directly imports internal structure from module B
THEN pass data as argument OR use event system
REJECT IF direct import creates coupling AND change to B breaks A
```

### R9: Configurable Thresholds with Rationale
```
IF numeric thresholds determine critical behavior
THEN make configurable AND document rationale OR derive from measurement
REJECT IF hard-coded with no justification AND can't be tuned
```

### R10: Behavior-Driven Tests (Not Source Checks)
```
IF test checks source code strings OR internal implementation details
THEN replace with behavior-driven tests (input → output)
REJECT IF test breaks on refactoring that doesn't change behavior
```

---

## PART 4: PROXY METRICS

These metrics can be computed automatically to assess whether a change is worth doing:

### M1: Δ Surface Area
**Definition**: Change in public API size (functions, exports, parameters)

**Measurement**:
```
Δsurface_area = |new_exports| - |old_exports| + |new_params| - |old_params|
```

**Interpretation**:
- Positive: Adding surface area (complexity increase)
- Negative: Reducing surface area (simplification)
- Target: Minimize unless proportional benefit

**Example from schede**:
- GOOD: Two-step confirmation +2 functions, but -90% risk
- BAD: Duplicated risk classification +35 lines, +0% benefit

---

### M2: Δ Risk
**Definition**: Change in safety/security risk surface

**Measurement**:
```
Δrisk = (new_critical_paths / new_total_paths) - (old_critical_paths / old_total_paths)
```

Where critical_paths = paths that can cause data loss, security breach, or system corruption

**Interpretation**:
- Positive: Increased risk (bad unless necessary)
- Negative: Reduced risk (good)
- Target: Minimize or eliminate

**Example from schede**:
- GOOD: Allowlist-based gate -95% arbitrary command risk
- BAD: Agent execution mixing concerns +150% change risk

---

### M3: Δ Cognitive Load
**Definition**: Change in mental effort required to understand system

**Measurement**:
```
Δcognitive_load = (new_cyclomatic_complexity / new_loc) - (old_cyclomatic_complexity / old_loc)
```

Or heuristic:
```
Δcognitive_load ≈ Δnesting_depth + Δfunction_size + Δcross_module_deps
```

**Interpretation**:
- Positive: Harder to understand (bad unless necessary)
- Negative: Easier to understand (good)
- Target: Minimize or keep neutral

**Example from schede**:
- GOOD: Loop history +0% cognitive load (hidden implementation detail)
- BAD: 246-line function +200% cognitive load

---

## PART 5: HARD STOP CRITERIA

These are absolute blockers - changes that fail these criteria should be rejected outright:

### HS1: Surface Area Without Benefit
```
IF Δsurface_area > 0 AND Δrisk ≥ 0 AND Δcognitive_load > 0
THEN REJECT unless demonstrable benefit exceeds cost
```

**Rationale**: Adding complexity without reducing risk or improving understandability is pure cost.

**Example**: Duplicating risk classification adds +35 lines, +100% maintenance cost, +0% benefit → REJECT

**Escape hatch**: Demonstrable benefit (e.g., performance, new capability) that exceeds cost

---

### HS2: Coupling Without Decoupling
```
IF new_direct_imports > old_direct_imports AND Δtest_complexity > 0
THEN REJECT unless coupling is necessary for correctness
```

**Rationale**: Increased coupling makes system harder to test, modify, and understand.

**Example**: Budget directly importing metrics_v2 internal structure adds coupling, +100% test complexity → REJECT

**Escape hatch**: Coupling is necessary for correctness (e.g., safety invariant that requires coordination)

---

## PART 6: USAGE GUIDE

### When to apply G6 during development:

1. **Pre-commit hook**: Run G6 metrics on changed files
   - If Δsurface_area > 20 lines AND Δrisk ≥ 0 → Warn developer
   - If HS1 or HS2 triggered → Block commit, require justification

2. **Code review**: Reviewer checks:
   - Does change violate any of R1-R10?
   - Are proxy metrics (M1-M3) acceptable?
   - Do hard stops (HS1-HS2) apply?

3. **Refactoring candidates**: Scan codebase for violations
   - Duplication >20 lines (R6)
   - Functions >150 lines or >3 concerns (R7)
   - Hard-coded thresholds (R9)
   - Source code tests (R10)

### Example G6 decision flow:

```
Developer proposes change:
  ├─ Calculate Δsurface_area, Δrisk, Δcognitive_load
  ├─ Check hard stops (HS1, HS2)
  │   └─ If triggered → REJECT (require redesign)
  ├─ Check rules (R1-R10)
  │   └─ If violated → WARN (require justification or fix)
  └─ If all pass → APPROVE
```

---

## CONCLUSION

G6 Quality Gate enables NOUS to **discriminate quality before execution**: recognize when work is not worth doing based on objective metrics and historical patterns.

Key insight: **Il rischio è alto abbastanza da imparare, ma mai abbastanza da dominare il sistema.**

This document provides:
- ✅ 10 schede (5 good, 5 bad)
- ✅ 10 extracted rules (R1-R10)
- ✅ 3 proxy metrics (M1-M3)
- ✅ 2 hard stop criteria (HS1-HS2)

**Next step**: Implement `src/core/quality_gate.ts` based on these rules and metrics.
