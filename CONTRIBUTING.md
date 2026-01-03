# Contributing to NOUS

## Pull Request (PR) Workflow

NOUS follows a PR-first workflow to ensure that all changes are reviewed and meet the project's quality standards before being merged into the main branch. This process helps maintain the integrity and reliability of the system.

### Steps to Contribute

1. **Fork the Repository**: Create a personal copy of the repository by forking it.

2. **Clone the Fork**: Clone your forked repository to your local machine.

3. **Create a Branch**: Create a new branch for your feature or bug fix.
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make Changes**: Implement your changes in the codebase.

5. **Run Tests**: Ensure that all tests pass and your changes do not break existing functionality.
   ```bash
   npm run nous test
   ```

6. **Commit Changes**: Commit your changes with a descriptive message.
   ```bash
   git commit -m "Add feature: your feature description"
   ```

7. **Push to Fork**: Push your changes to your forked repository.
   ```bash
   git push origin feature/your-feature-name
   ```

8. **Create a Pull Request**: Open a pull request from your branch to the main repository's main branch.

9. **Address Feedback**: Be prepared to make changes based on feedback from maintainers.

## Quality Gate Policies

NOUS has a set of quality gate policies to ensure that all contributions meet the project's standards for reliability and performance.

### Definition of Done

- **Safety Mechanisms**: All critical safety mechanisms must be implemented and tested.
- **Risk Classification**: Ensure param-aware risk classification is validated.
- **Trust System**: The trust system must be robust and not exploitable.
- **Loop Detection**: Persistent loop detection with decay must be in place.
- **Rollback Mechanism**: The rollback mechanism must be verified end-to-end.
- **Test Repeatability**: All tests must be repeatable and passing.

### Operational Metrics

- **Tool Calls**: Achieve a minimum of 1000 tool calls with a validity rate of at least 95%.
- **Loop Detection Rate**: Maintain a loop detection rate of less than 2%.
- **Consolidation Yield**: Achieve a consolidation yield of at least 0.5.

### Stress Testing

- **Integration Test**: Ensure the system remains stable under stress and dangerous operations are blocked or tracked.

### Documentation

- **Critical Systems**: Document all critical systems and ensure transparency.

By following these guidelines, contributors can help maintain the high standards of NOUS and ensure its continued development and success.
