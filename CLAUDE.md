# Panopticon Development Guide

Project-specific instructions for AI assistants working on Panopticon.

## Project Overview

Panopticon is a multi-agent orchestration framework for AI coding assistants. It provides:
- Universal skills synced across Claude Code, Codex, Cursor, Gemini CLI
- Agent spawning and health monitoring via tmux
- Dashboard for issue tracking and agent management
- GUPP hooks for self-propelling agents

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/cli/` | CLI commands (`pan work`, `pan sync`, etc.) |
| `src/dashboard/frontend/` | React dashboard (port 3001) |
| `src/dashboard/server/` | Express API server (port 3002) |
| `~/.panopticon/skills/` | Skills distributed with Panopticon |
| `~/.panopticon/agents/` | Per-agent state and health |

## Skills Management

**IMPORTANT:** When adding or updating skills, consider whether they belong in Panopticon distribution.

| Keep Local (`~/.claude/skills/`) | Add to Panopticon (`~/.panopticon/skills/`) |
|----------------------------------|---------------------------------------------|
| Project-specific (MYN, personal) | Generally useful to all users |
| Experimental/WIP | Multi-agent workflow helpers |
| User's private workflows | Wraps common CLI tools (beads, etc.) |

**After updating a skill that should ship with Panopticon:**
```bash
cp -r ~/.claude/skills/my-skill ~/.panopticon/skills/my-skill
pan sync  # Distribute to all AI tools
```

**Current Panopticon skills:**
- `beads` - Git-backed issue tracking
- `feature-work`, `bug-fix`, `refactor` - Development workflows
- `code-review`, `code-review-security`, `code-review-performance` - Review checklists
- `release`, `dependency-update`, `incident-response` - Operations
- `onboard-codebase` - Learning new codebases
- `session-health`, `skill-creator`, `web-design-guidelines` - Utilities

## Dashboard Development

```bash
# Start in dev mode (hot reload)
cd src/dashboard && npm run dev
# Frontend: http://localhost:3001
# API: http://localhost:3002

# Rebuild backend after changes
cd src/dashboard/server && npm run build
```

## CLI Development

```bash
# Build CLI
npm run build

# Test commands
node dist/cli/index.js doctor
node dist/cli/index.js skills
```

## Testing Changes

No automated tests yet. Manual testing:
1. `pan doctor` - Health check
2. `pan sync --dry-run` - Skill sync preview
3. Dashboard - Test UI changes at localhost:3001
