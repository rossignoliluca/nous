# Contributing Guide

## PR-First Autonomous Cycle

Our workflow follows a PR-first approach, which means all changes must be submitted through Pull Requests (PRs). This ensures that every modification is reviewed and meets our quality standards before being merged.

### Quality Gate: G6 Deterministic

The G6 quality gate is a deterministic system, meaning it does not rely on machine learning models (LLMs) but rather on predefined rules and checks. This ensures consistent and reliable evaluation of code changes.

### Golden Set Requirement

For a PR to pass the quality gate, it must achieve 100% accuracy on our golden set of test cases. This means all 10 out of 10 test cases must pass without exception.

### Protected Surface

Please note that the `src/control/**` directory is a protected surface. Autonomous cycles are not allowed to modify files within this directory to ensure stability and integrity of critical components.

### Outcomes

There are three possible outcomes for a PR:
- **PASS**: The PR meets all requirements and is ready to be merged.
- **REVIEW**: The PR requires further review or modifications before it can be accepted.
- **REJECT**: The PR does not meet the necessary criteria and is logged for further analysis.

### Contribution Limits

Each cycle is limited to a maximum of 3 PRs and 5 REVIEWs to ensure manageable workloads and maintain quality.

Thank you for contributing to our project! Please ensure all changes adhere to these guidelines to facilitate a smooth and efficient review process.