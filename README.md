# Panopticon CLI

Multi-agent orchestration for AI coding assistants.

> *"The Panopticon had six sides, one for each of the Founders of Gallifrey..."*

## Overview

Panopticon is a unified orchestration layer for AI coding assistants. It works with:

| Tool | Support |
|------|---------|
| **Claude Code** | Full support |
| **Codex** | Skills sync |
| **Cursor** | Skills sync |
| **Gemini CLI** | Skills sync |
| **Google Antigravity** | Skills sync |

### Features

- **Multi-agent orchestration** - Spawn and manage multiple AI agents in tmux sessions
- **Universal skills** - One SKILL.md format works across all supported tools
- **GUPP Hooks** - Self-propelling agents that auto-resume work
- **Health Monitoring** - Deacon-style stuck detection with auto-recovery
- **Context Engineering** - Structured state management (STATE.md, WORKSPACE.md)
- **Agent CVs** - Work history tracking for capability-based routing

## Quick Start

```bash
# Install Panopticon
npm install -g panopticon-cli

# Initialize configuration
pan init

# Sync skills to all AI tools
pan sync

# Check system health
pan doctor
```

## Requirements

- Node.js 18+
- tmux (for agent sessions)
- Git (for worktree-based workspaces)
- Linear API key (for issue tracking)

## Configuration

Create `~/.panopticon.env`:

```bash
LINEAR_API_KEY=lin_api_xxxxx
GITHUB_TOKEN=ghp_xxxxx  # Optional: for secondary tracker
```

## Commands

### Core Commands

```bash
pan init              # Initialize ~/.panopticon/
pan sync              # Sync skills to all AI tools
pan doctor            # Check system health
pan skills            # List available skills
pan status            # Show running agents
```

### Agent Management

```bash
# Spawn an agent for a Linear issue
pan work issue MIN-123

# List all running agents
pan work status

# Send a message to an agent
pan work tell min-123 "Please also add tests"

# Kill an agent
pan work kill min-123
```

### Health Monitoring

```bash
# Run a health check
pan work health check

# Show health status of all agents
pan work health status

# Start the health daemon (background monitoring)
pan work health daemon --interval 30
```

### GUPP Hooks

```bash
# Check for pending work on hook
pan work hook check

# Push work to an agent's hook
pan work hook push agent-min-123 "Continue with tests"

# Send mail to an agent
pan work hook mail agent-min-123 "Review feedback received"
```

### Project Management

```bash
# Register a project
pan project add /path/to/project --name myproject

# List managed projects
pan project list

# Remove a project
pan project remove myproject
```

### Context Management

```bash
# Show agent state
pan work context state agent-min-123

# Set a checkpoint
pan work context checkpoint "Completed auth module"

# Search history
pan work context history "test"
```

### Agent CVs

```bash
# View an agent's CV (work history)
pan work cv agent-min-123

# Show agent rankings by success rate
pan work cv --rankings
```

### Crash Recovery

```bash
# Recover a specific crashed agent
pan work recover min-123

# Auto-recover all crashed agents
pan work recover --all
```

## Dashboard

Start the monitoring dashboard:

```bash
pan up
```

- Frontend: http://localhost:3001
- API: http://localhost:3002

Stop with `pan down`.

## Skills

Panopticon ships with 10+ high-value skills:

| Skill | Description |
|-------|-------------|
| `feature-work` | Standard feature development workflow |
| `bug-fix` | Systematic bug investigation and fix |
| `code-review` | Comprehensive code review checklist |
| `code-review-security` | OWASP Top 10 security analysis |
| `code-review-performance` | Algorithm and resource optimization |
| `refactor` | Safe refactoring with test coverage |
| `release` | Step-by-step release process |
| `incident-response` | Production incident handling |
| `dependency-update` | Safe dependency updates |
| `onboard-codebase` | Understanding new codebases |

Skills are synced to all supported AI tools via symlinks:

```bash
~/.panopticon/skills/    # Canonical source
    ↓ pan sync
~/.claude/skills/        # Claude Code + Cursor
~/.codex/skills/         # Codex
~/.gemini/skills/        # Gemini CLI
```

## Architecture

```
~/.panopticon/
  skills/             # Shared skills (SKILL.md format)
  commands/           # Slash commands
  agents/             # Per-agent state
    agent-min-123/
      state.json      # Agent state
      health.json     # Health status
      hook.json       # GUPP work queue
      cv.json         # Work history
      mail/           # Incoming messages
  projects.json       # Managed projects
  backups/            # Sync backups
```

## Health Monitoring (Deacon Pattern)

Panopticon implements the Deacon pattern for stuck agent detection:

- **Ping timeout**: 30 seconds
- **Consecutive failures**: 3 before recovery
- **Cooldown**: 5 minutes between force-kills

When an agent is stuck (no activity for 30+ minutes), Panopticon will:
1. Force kill the tmux session
2. Record the kill in health.json
3. Respawn with crash recovery context

## GUPP (Give Up Push Pop)

> "If there is work on your Hook, YOU MUST RUN IT."

GUPP ensures agents are self-propelling:
1. Work items are pushed to the agent's hook
2. On spawn/recovery, the hook is checked
3. Pending work is injected into the agent's prompt
4. Completed work is popped from the hook

## ⭐ Star History

<a href="https://star-history.com/#eltmon/panopticon&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=eltmon/panopticon&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=eltmon/panopticon&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=eltmon/panopticon&type=Date" />
 </picture>
</a>

## ⚖️ License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2026 Edward Becker

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
