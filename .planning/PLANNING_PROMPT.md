# Planning Session: PAN-6

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
- **ID:** PAN-6
- **Title:** Add subagent templates for common orchestration patterns
- **URL:** https://github.com/eltmon/panopticon-cli/issues/6

## Description
## Background

Panopticon plans to ship with 10+ Skills (reusable workflow prompts), but should ALSO ship **Subagents** for patterns that benefit from isolation, parallel execution, or tool restrictions.

### Skills vs Subagents

| Concept | Isolation | Use Case |
|---------|-----------|----------|
| **Skills** | None - runs in main conversation | Reusable workflow guidance |
| **Subagents** | Separate context window | Parallel work, tool restrictions, cost optimization |

Claude Code subagents are Markdown files with YAML frontmatter that define isolated AI agents with their own context, tool restrictions, and model selection.

## Proposed Subagents

Based on PRD patterns (Convoy, Planning, Triage, Health Monitoring):

### 1. Convoy Review Agents (Parallel Code Review)

From PRD: `pan convoy start code-review --issue MIN-648` spawns parallel reviewers.

| Subagent | Model | Tools | Purpose |
|----------|-------|-------|---------|
| `code-review-correctness` | haiku | Read, Grep, Glob | Logic errors, edge cases, null handling |
| `code-review-security` | sonnet | Read, Grep, Glob | OWASP Top 10, vulnerabilities |
| `code-review-performance` | haiku | Read, Grep, Glob | Algorithms, N+1 queries, memory |
| `code-review-synthesis` | sonnet | Read, Write | Combine findings, write final report |

### 2. Planning Agent

For `work plan <id>` - creates execution plans before spawning workers.

```yaml
name: planning-agent
model: sonnet
tools: Read, Grep, Glob, WebFetch
permissionMode: plan
description: Research codebase and create detailed execution plans for issues
```

### 3. Codebase Explorer

Fast read-only exploration for understanding new codebases.

```yaml
name: codebase-explorer
model: haiku
tools: Read, Grep, Glob, Bash
description: Fast read-only codebase exploration. Use for architecture discovery and understanding.
```

### 4. Triage Agent

For `work triage` - helps categorize and prioritize issues from secondary trackers.

```yaml
name: triage-agent
model: haiku
tools: Read, Grep, Glob
description: Triage issues from secondary trackers, categorize by type and estimate complexity
```

### 5. Health Monitor (Deacon)

From PRD section on "Stuck Detection" - checks agent health.

```yaml
name: health-monitor
model: haiku
tools: Bash, Read
description: Check agent health, detect stuck sessions, analyze logs, suggest interventions
```

## File Structure

```
~/.panopticon/agents/           # Canonical source
├── code-review-correctness.md
├── code-review-security.md
├── code-review-performance.md
├── code-review-synthesis.md
├── planning-agent.md
├── codebase-explorer.md
├── triage-agent.md
└── health-monitor.md
```

These would be symlinked to `~/.claude/agents/` via `pan sync`.

## Acceptance Criteria

- [ ] Create 8 subagent template files
- [ ] Each subagent has appropriate tool restrictions (read-only where applicable)
- [ ] Each subagent uses cost-appropriate model (haiku for simple tasks)
- [ ] Update `pan sync` to symlink agents to `~/.claude/agents/`
- [ ] Document subagent usage in README
- [ ] Test convoy pattern with parallel review agents

## References

- PRD Section: "Parallel Agent Execution (Convoys via Skills)"
- PRD Section: "Part 7: Stuck Detection and Health Monitoring"
- Claude Code Subagent Docs: https://docs.anthropic.com/en/docs/claude-code/sub-agents

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
