---
argument-hint: "[--all]"
description: Implement the tasks in docs/{current_branch}/tasks.md group by group, or all at once with --all
model: opus
---

## Arguments
`--all` (optional, implements every task in one run)

## Instructions
1. **Read `docs/{current_branch}/tasks.md`** (get `{current_branch}` from `git branch --show-current`): Understand the task list and its order.
2. **Refer to `docs/{current_branch}/spec.md` and `docs/{current_branch}/plan.md`**: Check the requirements and the technical decisions.
3. **Implementation strategy**:
   - With `--all`: Implement every task in one run.
   - Without `--all`: Implement one task group, then stop and wait for the user's approval before starting the next group.
4. **For each task**:
   - Mark it as in progress in `tasks.md`.
   - Implement the feature (clean code, following the existing patterns).
   - Test that it works.
   - Mark it as done in `tasks.md`.

## Report
   - What was implemented
   - Files created or modified
   - How to test it (manual test steps, test commands, expected results, edge cases)
   - Next steps (when `--all` was not used)
