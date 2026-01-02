# Definition of Done - NOUS Mature Guardrails

## Philosophy

"Strumento maturo" means:
- **Comportamento garantito**, not just "codice corretto"
- Metrics reflect **proven competence**, not volume
- Safety mechanisms **demonstrated** under stress
- Every claim has **repeatable evidence**

---

## 1. Safety Tier (NON-NEGOTIABLE)

### Rollback Test Passed
- ✅ Snapshot creation works
- ✅ Manual rollback restores config
- ✅ Snapshot history preserved (sliding window)
- ✅ Rollback mechanism verified end-to-end

**Evidence:** `npm run nous test` → Rollback Circuit suite passes

### Loop Detection Operational
- ✅ Loop history persistent across invocations
- ✅ Decay mechanism (200-event sliding window)
- ✅ Recent window expanded (20 events)
- ✅ Repetitive failures recorded and tracked

**Evidence:** `data/loop_history.json` exists, max 200 entries

### Param-Aware Risk Classification
- ✅ Dangerous commands (`rm -rf`, `git reset --hard`, `git push --force`) → core risk
- ✅ Critical files (`config/`, `src/`, `package.json`) → core risk
- ✅ Readonly operations correctly classified

**Evidence:** `npm run nous test` → Param-Aware Risk suite passes

### Evidence Thresholds Enforced
- ✅ Trust tier gates: Tier 2 (30%) requires 5+ write ops, Tier 3 (60%) requires 3+ core ops
- ✅ Trust capped at 30% without write operations
- ✅ Trust capped at 60% without core operations
- ✅ No trust farming possible

**Evidence:** `npm run nous test` → Evidence Thresholds suite passes

---

## 2. Operational Tier (MATURITY METRICS)

### Baseline Metrics (Minimum 1000 Tool Calls)

Must achieve on real operational usage (not synthetic):

| Metric | Target | Status |
|--------|--------|--------|
| **Total Tool Calls** | ≥ 1000 | Pending real usage |
| **Tool Validity Rate** | ≥ 95% | Pending real usage |
| **Loop Detection Rate** | < 2% | Pending real usage |
| **Consolidation Yield** | ≥ 0.5 | Pending real usage |

**Verification:** `npm run nous metrics` after 1000+ operations

### Trust Ladder Proven

Must demonstrate actual progression through trust tiers:

| Tier | Requirements | Evidence |
|------|--------------|----------|
| **0-30%** | Readonly operations only | N/A (achievable) |
| **30-60%** | ≥ 5 successful write ops | Must demonstrate in logs |
| **60%+** | ≥ 3 successful core ops | Must demonstrate in logs |

**Verification:** Metrics history shows progression through tiers

---

## 3. Stress Test Tier (COMPORTAMENTO GARANTITO)

### Integration Test Passed
- ✅ Full circuit: stress → protect → recover
- ✅ Dangerous operations blocked/tracked
- ✅ Degradation detected
- ✅ System remains stable under stress

**Evidence:** `npm run nous test` → Integration Test suite passes (100%)

### Budget Breach Handling
- ✅ Exploration budget system exists
- ✅ Budget has configurable ceiling
- ✅ Budget breach logged
- ⏳ Budget breach triggers deterministic stop (pending real test)

**Verification:** Exploration system responds to budget limits

---

## 4. Documentation Tier (TRANSPARENCY)

### Critical Systems Documented
- ✅ `CRITICAL_FIXES.md` - 3 fixes with examples
- ✅ `DEFINITION_OF_DONE.md` - This file
- ✅ Test suite code is self-documenting
- ⏳ `BASELINE.md` - Comparison metrics (pending)

### Remaining Acknowledged Risks
- **Rollback auto-trigger test:** Manual rollback verified, auto-trigger requires extreme degradation simulation (acknowledged limitation)
- **Denylist maintenance:** Dangerous commands list not exhaustive, needs periodic review
- **Path traversal:** Simple regex doesn't catch all patterns (symlinks, etc.)
- **Baseline comparison:** No before/after benchmark yet

---

## 5. Test Suite Tier (REPEATABILITY)

### All Tests Pass
- ✅ 21/21 guardrails tests pass
- ✅ Rollback Circuit (5 tests)
- ✅ Loop Detection & Non-Repetition (4 tests)
- ✅ Param-Aware Risk Classification (3 tests)
- ✅ Evidence Thresholds (5 tests)
- ✅ Budget Breach (3 tests)
- ✅ Integration Test (1 test)

**Command:** `npm run nous test`

**Expected Output:** `📊 Results: 21/21 passed (100.0%)`

### Tests Cover Critical Paths
- ✅ Snapshot creation and restoration
- ✅ Loop history persistence and decay
- ✅ Risk classification patterns
- ✅ Trust tier enforcement
- ✅ Budget mechanism
- ✅ Full stress → protect → recover circuit

---

## Current Status Summary

| Category | Status | Evidence |
|----------|--------|----------|
| **Safety Mechanisms** | ✅ PASS | All 21 tests pass |
| **Operational Metrics** | ⏳ PENDING | Needs 1000+ real operations |
| **Stress Testing** | ✅ PASS | Integration test passes |
| **Documentation** | ✅ PASS | CRITICAL_FIXES.md + this file |
| **Test Repeatability** | ✅ PASS | `npm run nous test` → 100% |

---

## What "DONE" Means

**Done ≠ Perfect**

Done means:
1. ✅ Critical safety mechanisms **implemented and tested**
2. ✅ Risk classification **param-aware and validated**
3. ✅ Trust system **cannot be gamed** (evidence thresholds)
4. ✅ Loop detection **persistent with decay**
5. ✅ Rollback mechanism **verified end-to-end**
6. ✅ Tests **repeatable and passing**
7. ⏳ Operational metrics **pending real usage** (1000+ ops)

---

## Next Steps (Beyond DoD)

1. **Baseline creation:** Run same task with/without autopoiesis for comparison
2. **Real usage test:** Accumulate 1000+ tool calls in actual use
3. **Auto-trigger stress test:** Simulate extreme degradation that triggers automatic rollback
4. **Denylist expansion:** Add more dangerous patterns (e.g., `dd`, `mkfs`, malicious pipes)
5. **Path traversal hardening:** Use path normalization, not just regex

---

## Acceptance Criteria

NOUS guardrails are "mature" when:

```bash
# 1. All tests pass
npm run nous test
# → 21/21 tests pass (100%)

# 2. System validates
npm run nous validate
# → All validation checks pass

# 3. Metrics show operational maturity (after real usage)
npm run nous metrics
# → toolCallsTotal >= 1000
# → toolValidityRate >= 0.95
# → loopDetections < 2%
```

**Sign-off:** When all three commands pass, guardrails are production-ready.

---

**Document Version:** 1.0
**Last Updated:** 2026-01-02
**Status:** Tests ✅ | Operational Metrics ⏳ | DoD Satisfied: 5/6 criteria
