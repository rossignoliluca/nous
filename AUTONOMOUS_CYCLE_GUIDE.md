# NOUS Autonomous Cycle - PR-First Batch Runner

**Non-interactive autonomous execution with safety controls.**

## Overview

The autonomous cycle enables NOUS to work in background for 1-2 hour periods, safely implementing micro-tasks and creating PRs/Issues for human review.

### Safety Triangle (Complete)

✅ **Safety Gate** (Operational) - Router-level capability controls
✅ **Budget System** - Exploration budget with auto-adjustment
✅ **Quality Gate (G6)** - 100% golden set accuracy

## Architecture

```
Task Queue → Cycle Runner → Agent → Safety Gate → Quality Gate → PR/Issue
```

### Workflow Per Iteration

1. **Select** micro-task from queue (highest priority)
2. **Generate** solution using agent (max 5 steps per task)
3. **Run** Safety Gate (router-level, pre-execution)
4. **Run** Quality Gate (BEFORE any commit)
5. **Branch** on result:
   - `PASS` → create PR (max 3 per cycle)
   - `REVIEW` → create Issue with review questions (max 5 per cycle)
   - `REJECT` → log decision and continue

## Usage

### Basic Command

```bash
# Run 2-hour cycle with default settings
node dist/index.js cycle

# Run 15-minute cycle
node dist/index.js cycle --minutes 15

# Custom iteration limit
node dist/index.js cycle --minutes 120 --iterations 20

# Use custom task queue
node dist/index.js cycle --queue ./my-tasks.json
```

### Background Execution

```bash
# Run in background with output to file
node dist/index.js cycle --minutes 120 > cycle.log 2>&1 &

# Monitor progress
tail -f cycle.log

# Check process
ps aux | grep "node dist/index.js cycle"
```

## Task Queue Format

Create `data/queue/tasks.json`:

```json
{
  "tasks": [
    {
      "id": "T-001",
      "intent": "Add error handling to X function",
      "context": {
        "file": "src/core/module.ts",
        "function": "functionName",
        "zone": "error handling"
      },
      "priority": 0.8,
      "rule": "R9",
      "estimatedBenefit": "Improved robustness"
    },
    {
      "id": "T-002",
      "intent": "Extract magic numbers to constants",
      "context": {
        "file": "src/core/other.ts",
        "zone": "constants"
      },
      "priority": 0.7,
      "rule": "R9",
      "estimatedBenefit": "Improved maintainability"
    }
  ],
  "source": "manual",
  "createdAt": "2026-01-02T22:00:00Z"
}
```

### Task Fields

- **id**: Unique identifier (e.g., "T-001")
- **intent**: Clear, actionable description
- **context**: File, function, or zone to modify
- **priority**: 0.0-1.0 (higher = earlier execution)
- **rule**: Quality rule reference (R6-R10, optional)
- **estimatedBenefit**: Expected improvement (optional)

## Hard Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| Max Iterations | 40 | Prevent infinite loops |
| Max PRs | 3 | Human review capacity |
| Max REVIEWs | 5 | Decision bandwidth |
| Max Consecutive REVIEWs | 3 | Force stop if uncertain |
| Task Timeout | 5 min | Per-task execution limit |

## Stop Conditions

The cycle **immediately stops** if:

- ⏸️ **3 consecutive REVIEWs** → Needs human guidance
- 🛑 **Any ERR_*** critical gate event
- 📉 **Golden set regression** detected
- 🔒 **Protected file touched** (see below)
- ⏰ **Time limit reached**
- 🎯 **PR or REVIEW cap reached**

## Protected Files (Never Modified)

- `axioms` - Immutable system axioms
- `operational_gate` - Safety gate logic
- `quality_gate.ts` - Quality gate logic (not integration)
- `silence` - Core silence system
- `metrics_v2.ts` - Trust and metrics core
- `package.json` - Dependencies
- `.env` - Environment config
- `tsconfig.json` - TypeScript config

**If a task touches these, cycle stops immediately.**

## Output Report

End-of-cycle report includes:

```
📊 CYCLE COMPLETE - FINAL REPORT

⏱️  Duration: 118.5 minutes
🔄 Iterations: 15/40
📋 Tasks remaining: 5

📈 Results:
   PASS:   8
   REVIEW: 3
   REJECT: 2
   SKIP:   1
   ERROR:  1

🎯 Quality Gate Stats:
   PRs created:       2/3
   Reviews created:   3/5
   Rejects logged:    2

✅ Pull Requests Created (2):
   1. https://github.com/.../pull/47
      Task: Add error handling to X
   2. https://github.com/.../pull/48
      Task: Extract constants

🔍 Review Issues Created (3):
   1. https://github.com/.../issues/12
      Task: Refactor complex function
   2. https://github.com/.../issues/13
      Task: Update validation logic
   3. https://github.com/.../issues/14
      Task: Trade-off decision needed

💰 Exploration Budget:
   Current: 6.5%
   Used: 12/120

🏁 Cycle ended: completed
```

## Quality Gate Decisions

### PASS → PR Created

- Code improvement with clear benefit
- Risk acceptable (M2 < 30%)
- Cognitive load improvement (M3 ↓)
- PR includes:
  - Reason codes (R6-R10)
  - Metrics (M1, M2, M3)
  - Justification template
  - **DO NOT auto-merge** warning

### REVIEW → Issue Created

- Ambiguous trade-off
- Medium risk (30% < M2 < 60%)
- Missing benefit evidence
- Issue includes:
  - Review questions
  - Why alternatives were considered
  - Which metrics to track
  - Trade-off analysis

### REJECT → Logged

- High risk (M2 > 60%)
- No clear benefit
- Violates hard stops (HS1, HS2)
- Logged to `data/quality_gate/decisions.jsonl`

## Example: 2-Hour Cycle

```bash
# Create task queue
cat > data/queue/tasks.json <<EOF
{
  "tasks": [
    {
      "id": "T-001",
      "intent": "Add JSDoc to public functions in cycle.ts",
      "context": {"file": "src/core/cycle.ts"},
      "priority": 0.7,
      "rule": "R9"
    },
    {
      "id": "T-002",
      "intent": "Extract error messages to constants",
      "context": {"file": "src/core/agent.ts", "zone": "error handling"},
      "priority": 0.8,
      "rule": "R9"
    }
  ],
  "source": "manual",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Run cycle in background
nohup node dist/index.js cycle --minutes 120 > cycle_$(date +%Y%m%d_%H%M%S).log 2>&1 &

# Save PID
echo $! > cycle.pid

# Monitor
tail -f cycle_*.log

# Stop if needed
kill $(cat cycle.pid)
```

## Best Practices

### Task Design

1. **Small, focused changes** - One intent per task
2. **Clear context** - Specify file and function
3. **Prioritize by value** - High priority = high impact
4. **Avoid protected files** - Cycle will stop if touched
5. **Estimate conservatively** - Tasks should complete in <5 min

### Queue Management

1. **Start small** - 3-5 tasks for first cycle
2. **Review outputs** - Check PRs/Issues after each cycle
3. **Adjust priorities** - Based on what gets REVIEWed
4. **Remove stale tasks** - If context changes

### Monitoring

1. **Watch for stops** - Check stop reason if cycle ends early
2. **Review consecutive REVIEWs** - May indicate unclear tasks
3. **Check error patterns** - Adjust task complexity if many errors
4. **Track PR merge rate** - Validate quality gate is working

## Next Steps

### Generate Tasks Automatically (Future)

```bash
# Atlas tension scan (not yet implemented)
node dist/index.js atlas scan --output data/queue/tasks.json

# This would generate tasks based on:
# - Coupling analysis
# - Cognitive load measurement
# - Duplication detection
# - Magic number scanning
# - Boundary clarity issues
```

### Integration with CI/CD

```yaml
# .github/workflows/nous-cycle.yml
name: NOUS Autonomous Cycle

on:
  schedule:
    - cron: '0 */2 * * *' # Every 2 hours
  workflow_dispatch: # Manual trigger

jobs:
  cycle:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
      - run: node dist/index.js cycle --minutes 120
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Troubleshooting

### Cycle Stops Immediately

- Check `data/queue/tasks.json` exists and is valid JSON
- Verify no tasks touch protected files
- Check API key is set

### Many REVIEWs, Few Passes

- Tasks may be too complex
- Break down into smaller units
- Add more context to task descriptions

### Timeout Errors

- Reduce task scope
- Check LLM API rate limits
- Increase per-task timeout if needed

### No PRs Created

- Check quality gate logs: `data/quality_gate/decisions.jsonl`
- Review reason codes for REJECT decisions
- Adjust tasks to have clearer benefit

## Summary

The autonomous cycle enables **safe, controlled background iteration** with:

- ✅ Task queue system (file-based, Atlas-ready)
- ✅ Protected files enforcement
- ✅ Hard limits (3 PRs, 5 REVIEWs, 40 iterations)
- ✅ Stop conditions (3 consecutive REVIEWs, errors)
- ✅ Quality gate integration (PASS/REVIEW/REJECT)
- ✅ PR/Issue creation (never auto-merge)
- ✅ Comprehensive reporting

**Ready for 1-2 hour autonomous cycles while you work on other tasks.**
