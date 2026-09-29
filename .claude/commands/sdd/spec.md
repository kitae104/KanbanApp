---
argument-hint: "<requirements>"
description: Analyze requirements and write docs/{current_branch}/spec.md
model: opus
---

## Arguments
$1 (Korean or English)

## Instructions
1. **Analyze**: Carefully analyze the provided requirements.
2. **Create `docs/{current_branch}/spec.md`** (get `{current_branch}` from `git branch --show-current`) with these sections:
   - Original Requirements (the user's input, verbatim)
   - Overview (a short summary)
   - Goals (clear objectives)
   - User Stories (scenarios from the user's perspective)
   - Functional Requirements (what the system must do)
   - Non-Functional Requirements (performance, security, accessibility)
   - Constraints & Assumptions (constraints and assumptions)
   - Success Criteria (criteria for success)

## Report
1. Show a summary of the key points.
2. Tell the user to run `/sdd:plan [tech-stack]` as the next step.

## Quality
- Clear, unambiguous, and complete
- Testable and measurable
- Consistent with the user's requirements
