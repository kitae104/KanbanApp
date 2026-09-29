---
argument-hint: "[notes]"
description: Read spec.md and plan.md, then break the work into tasks in docs/{current_branch}/tasks.md
model: opus
---

## Arguments
$1 (optional, Korean or English)

## Instructions
1. **Read the documents**: Read and understand `docs/{current_branch}/spec.md` and `docs/{current_branch}/plan.md` (get `{current_branch}` from `git branch --show-current`).
2. **Create `docs/{current_branch}/tasks.md`**:
   - Group the work into Task Groups.
   - Number each task in the format **T-001**, **T-002**, ...
   - Give each task a Purpose and Required (Yes/No).
   - Keep each task atomic and testable.
   - Order the tasks by their dependencies.

## Report
1. Show the total number of tasks, the number of groups, a summary of each task (ID, description, purpose, required), and the complexity of each group (Low/Medium/High).
2. Tell the user to run `/sdd:implement [--all]` as the next step.

## Quality
- Covers every aspect of the spec and the plan
- Clear and realistic in scope
