# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-03

### Added
- Test suite with 51/51 passing tests (100%)
- Golden set validation with 10/10 test cases (100% accuracy)
- Quality Gate G6 with deterministic rule-based classification
- Operational safety gate with command allowlist and path validation
- Exploration budget system with asymmetric trust adjustment
- Autonomous cycle runner with PR-first workflow

### Changed
- Extracted classifyToolRisk to single source of truth (risk_classifier.ts)
- Eliminated code duplication between agent.ts and operational_gate.ts

### Fixed
- Test SMOKE 3a now uses critical file to trigger budget check
