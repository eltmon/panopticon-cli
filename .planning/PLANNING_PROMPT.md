# Planning Session: PAN-17

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
- **ID:** PAN-17
- **Title:** XTerminal performance issues with interactive prompts and connection handling
- **URL:** https://github.com/eltmon/panopticon-cli/issues/17

## Description
## Problem

The web-based terminal component (XTerminal) in the dashboard has several performance and usability issues:

### 1. Arrow keys don't work properly in Claude Code interactive prompts

When Claude Code displays an `AskUserQuestion` multi-select prompt:
- Arrow keys don't move the selection cursor (`>`)
- Instead, they behave like document editing navigation
- Users cannot select options without using tmux directly

**Workaround:** `tmux attach -t <session>` to interact directly

### 2. Port exhaustion on heavy usage

After extended use, the Vite proxy starts failing with:
```
Error: connect EADDRNOTAVAIL 127.0.0.1:3011 - Local (0.0.0.0:0)
```

This indicates ephemeral port exhaustion from websocket connections not being properly cleaned up.

### 3. Connection handling

- Connections pile up over time (observed 100+ established connections to port 3011)
- No apparent connection pooling or cleanup
- Requires full dashboard restart to recover

## Technical Context

- XTerminal uses xterm.js + websocket to connect to tmux sessions
- The websocket server is in `src/dashboard/server/index.ts`
- Terminal component: `src/dashboard/frontend/src/components/XTerminal.tsx`

## Suggested Improvements

1. **Escape sequence passthrough**: Ensure arrow key escape sequences are properly passed through to the underlying tmux/Claude Code process
2. **Connection cleanup**: Implement proper websocket connection cleanup on disconnect
3. **Connection pooling**: Consider connection limits or pooling
4. **Health monitoring**: Add connection count monitoring to `/api/health`

## Environment

- Node.js 20
- xterm.js (version in package.json)
- WSL2 on Windows

## Priority

P2 - Annoying but has workarounds (tmux attach, dashboard restart)

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
