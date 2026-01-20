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
| `src/dashboard/frontend/` | React dashboard (port 3010) |
| `src/dashboard/server/` | Express API server (port 3011) |
| `~/.panopticon/skills/` | Skills distributed with Panopticon |
| `~/.panopticon/agents/` | Per-agent state and health |

## Skills Management

**IMPORTANT:** The repo `skills/` directory is the source of truth for Panopticon-bundled skills.

**Distribution flow:**
```
repo/skills/           ← SOURCE OF TRUTH (commit here)
       ↓ pan init / npm postinstall
~/.panopticon/skills/  ← Runtime copy on user's machine
       ↓ pan sync
~/.claude/skills/      ← Symlinked for AI tools
```

**When creating/updating skills for Panopticon:**
1. Create/edit in `skills/{name}/SKILL.md` (in your feature branch)
2. Commit to your feature branch
3. Test by copying to `~/.panopticon/skills/` and running `pan sync`
4. PR/review, merge to main
5. Skills ship with next `npm publish`

**DO NOT** create skills directly in `~/.panopticon/skills/` - that's the runtime copy, not the source.

**Skill types:**
| Type | Location | Example |
|------|----------|---------|
| Panopticon-bundled | `repo/skills/` | `pan-help`, `beads`, `feature-work` |
| Project-specific | `{project}/.claude/skills/` | `myn-standards` |
| User personal | `~/.claude/skills/` | Experimental, private |

**Current Panopticon skills (in repo):**
- `pan-*` - Panopticon operation guides (help, install, setup, up, down, etc.)
- `beads` - Git-backed issue tracking
- `feature-work`, `bug-fix`, `refactor` - Development workflows
- `code-review`, `code-review-security`, `code-review-performance` - Review checklists
- `release`, `dependency-update`, `incident-response` - Operations

## Dashboard Development

```bash
# Start in dev mode (hot reload)
cd src/dashboard && npm run dev
# Frontend: http://localhost:3010
# API: http://localhost:3011

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
3. Dashboard - Test UI changes at localhost:3010
