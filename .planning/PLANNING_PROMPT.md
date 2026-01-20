# Planning Session: PAN-1

## CRITICAL: PLANNING ONLY - NO IMPLEMENTATION

**YOU ARE IN PLANNING MODE. DO NOT:**
- Write or modify any code files (except STATE.md)
- Run implementation commands (npm install, docker compose, make, etc.)
- Create actual features or functionality
- Start implementing the solution

**YOU SHOULD ONLY:**
- Ask clarifying questions (use AskUserQuestion tool)
- Explore the codebase to understand context (read files, grep)
- Generate planning artifacts:
  - STATE.md (decisions, approach, architecture)
  - Beads tasks (via `bd create`)
  - PRD file at `docs/prds/active/{issue-id}-plan.md` (copy of STATE.md, required for dashboard)
- Present options and tradeoffs for the user to decide

When planning is complete, STOP and tell the user: "Planning complete - click Done when ready to hand off to an agent for implementation."

---

## Issue Details
- **ID:** PAN-1
- **Title:** Add Rally support as secondary tracker
- **URL:** https://github.com/eltmon/panopticon-cli/issues/1

## Description
## Summary

Add support for Rally as a secondary issue tracker alongside Linear and GitHub.

## Context

Panopticon currently supports:
- **Linear** - Primary tracker (full support)
- **GitHub Issues** - Secondary tracker (partial support)

Rally (Broadcom) is a common enterprise issue tracker that should be supported for teams using it.

## Acceptance Criteria

- [ ] Rally API integration for fetching issues
- [ ] Rally webhook support for real-time updates (if available)
- [ ] Issue mapping from Rally to Panopticon workspace format
- [ ] Documentation for Rally configuration

## Technical Notes

- Rally REST API: https://rally1.rallydev.com/slm/webservice/v2.0/
- Authentication via API key
- Consider rate limiting implications

---

## Your Mission

You are a planning agent conducting a **discovery session** for this issue.

### Phase 1: Understand Context
1. Read the codebase to understand relevant files and patterns
2. Identify what subsystems/files this issue affects
3. Note any existing patterns we should follow

### Phase 2: Discovery Conversation
Use AskUserQuestion tool to ask contextual questions:
- What's the scope? What's explicitly OUT of scope?
- Any technical constraints or preferences?
- What does "done" look like?
- Are there edge cases we need to handle?

### Phase 3: Generate Artifacts (NO CODE!)
When discovery is complete:
1. Create STATE.md with decisions made
2. Create beads tasks with dependencies using `bd create`
3. Summarize the plan and STOP

**Remember:** Be a thinking partner, not an interviewer. Ask questions that help clarify.

Start by exploring the codebase to understand the context, then begin the discovery conversation.
