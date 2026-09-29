---
argument-hint: "[tech-stack]"
description: Read docs/{current_branch}/spec.md, decide the tech stack, and write docs/{current_branch}/plan.md
model: opus
---

## Arguments
$1 (optional, Korean or English)

## Instructions
1. **Read `docs/{current_branch}/spec.md`** (get `{current_branch}` from `git branch --show-current`): Understand the functional requirements.
2. **Decide the tech stack**:
   - If the user provided one, use that stack.
   - If not, analyze the project structure and choose appropriate technologies.
3. **Create `docs/{current_branch}/plan.md`** with these sections:
   - Original Tech Stack Request (the user's input, verbatim)
   - Technology Stack (technologies, frameworks, and libraries to use)
   - Architecture Overview (high-level system design)
   - Data Models (DB schema, data structures)
   - API Design (endpoints, requests/responses, if applicable)
   - Component Structure (component hierarchy, if applicable)
   - State Management (data flow)
   - Security Considerations (authentication, authorization, data protection)
   - Testing Strategy (unit/integration/E2E tests)
   - Deployment Plan (build, environment configuration)
   - Dependencies (packages and versions)

## Report
1. Summarize the rationale for technology choices and the key architectural decisions.
2. Tell the user to run `/sdd:tasks` as the next step.

## Quality
- Technically feasible and consistent with the spec
- Detailed enough for implementation and follows best practices
