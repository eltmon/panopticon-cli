# PAN-3: Comprehensive Agent Skills Suite - STATE

## Issue Summary
Create a full suite of `pan-*` skills that guide AI assistants through Panopticon operations. Skills should enable conversational guidance so users never need to learn CLI commands directly.

## Key Decisions

### 1. Skill Purpose
**Decision:** Skills are guidance wrappers + documentation.

Skills help AI assistants:
- Understand when to invoke which `pan` CLI commands
- Guide users through configuration decisions
- Provide context about how Panopticon components work together
- Offer troubleshooting guidance

### 2. Naming Convention
**Decision:** Use `pan-*` (dashes) for directory names.

- Directory: `~/.panopticon/skills/pan-help/`
- Skill name in SKILL.md: Can use `pan:help` or `pan-help` (both work for invocation)
- Matches existing skills: `bug-fix`, `feature-work`, `code-review-*`

### 3. Skill Location & Distribution
**Decision:** Repo is source of truth, runtime is a copy.

**Distribution flow:**
```
repo/skills/pan-*/           ← SOURCE OF TRUTH (version controlled)
       ↓ pan init / npm postinstall
~/.panopticon/skills/pan-*/  ← Runtime copy (user's machine)
       ↓ pan sync
~/.claude/skills/pan-*/      ← Symlinked for AI tools
```

**Workflow for creating/updating skills (for agents working on PAN-3):**
1. Create/edit skill in feature branch: `skills/{name}/SKILL.md`
2. Commit to feature branch (`feature/pan-3`)
3. Test locally by copying to `~/.panopticon/skills/` and running `pan sync`
4. When done with phase, PR/review
5. Merge to main
6. On release: `npm publish` includes skills in package
7. Users run `pan init` or update → skills copied to `~/.panopticon/skills/`

**Current workspace path:** `/home/eltmon/projects/panopticon/workspaces/feature-pan-3/`
**Skills directory:** `./skills/` (relative to workspace root)

**Note:** Phase 1 skills already exist in both:
- `~/.panopticon/skills/pan-*/` (working now via `pan sync`)
- `./skills/pan-*/` (committed to repo)

**Project-specific skills** (not Panopticon generic):
- Live in `{project}/.claude/skills/` (git-tracked in the project)
- These are NOT managed by Panopticon
- `pan sync` adds Panopticon skills alongside, never replaces project skills
- "Git-tracked always wins" - project skills take precedence

### 4. Docker Templates
**Decision:** Create app-type templates in `templates/docker/`

Templates needed:
- `spring-boot/` - Java/Spring with Maven, Postgres, Redis
- `react-vite/` - React with Vite hot-reload
- `nextjs/` - Next.js with app router
- `dotnet/` - .NET Core with SQL Server
- `python-fastapi/` - FastAPI with uvicorn
- `monorepo/` - Frontend + backend combo

Each template includes:
- `Dockerfile.dev` - Development Dockerfile
- `docker-compose.yml` - Service orchestration
- `README.md` - Usage instructions

### 5. Traefik/Networking
**Decision:** Traefik infrastructure already exists (PAN-4).

Skills (`pan-network`, `pan-docker`) will guide users through:
- Using existing Traefik setup
- Configuring workspace routing
- Platform-specific DNS setup (Linux, macOS, WSL2)

No new infrastructure needed - just guidance skills.

## Scope

### In Scope

**Skills to create (organized by priority):**

| Priority | Skill | Purpose |
|----------|-------|---------|
| P0 | `pan-help` | Entry point - overview of all commands and skills |
| P0 | `pan-install` | Guide through npm install, dependencies, env setup |
| P0 | `pan-setup` | First-time configuration wizard |
| P0 | `pan-quickstart` | Combined: install → setup → first workspace |
| P0 | `pan-up` | Start dashboard, API, Traefik |
| P0 | `pan-down` | Graceful shutdown of all services |
| P0 | `pan-status` | Check running agents, workspaces, health |
| P0 | `pan-plan` | Planning workflow with AI discovery |
| P0 | `pan-issue` | Create workspace + spawn agent |
| P1 | `pan-config` | View/edit Panopticon configuration |
| P1 | `pan-tracker` | Configure issue tracker (Linear/GitHub/GitLab) |
| P1 | `pan-projects` | Add/remove managed projects |
| P1 | `pan-docker` | Docker template selection and configuration |
| P1 | `pan-network` | Traefik, local domains, platform-specific setup |
| P1 | `pan-sync` | Sync skills to Claude Code |
| P1 | `pan-approve` | Review + approve agent work, merge MR |
| P1 | `pan-tell` | Send message to running agent |
| P1 | `pan-kill` | Stop a running agent |
| P1 | `pan-health` | System health check |
| P1 | `pan-diagnose` | Interactive troubleshooting |
| P2 | `pan-logs` | View logs from agents, dashboard, API |
| P2 | `pan-rescue` | Recover stuck agents, clean orphaned workspaces |

**Docker templates to create:**
- `templates/docker/spring-boot/`
- `templates/docker/react-vite/`
- `templates/docker/nextjs/`
- `templates/docker/dotnet/`
- `templates/docker/python-fastapi/`
- `templates/docker/monorepo/`

### Out of Scope

- New CLI commands (existing commands are sufficient)
- New infrastructure (Traefik already set up)
- State mapping configuration (`pan-states` deferred - complex topic)
- Skill creation guidance (`skill-creator` already exists)

## Architecture

### Skill Structure

Each skill follows this structure:
```
pan-{name}/
├── SKILL.md          # Main guidance content with YAML frontmatter
├── templates/        # (optional) Config templates, checklists
└── resources/        # (optional) Reference docs, examples
```

### Skill YAML Frontmatter
```yaml
---
name: pan-help
description: Overview of all Panopticon commands and capabilities
triggers:
  - pan help
  - panopticon help
  - what can panopticon do
allowed-tools:
  - Bash
  - Read
---
```

### Skill Content Pattern

Skills should include:
1. **Overview** - What this skill helps with
2. **When to use** - Trigger conditions
3. **Workflow** - Step-by-step guidance
4. **CLI commands** - Which `pan` commands to run
5. **Troubleshooting** - Common issues and fixes

## Implementation Order

### Phase 1: Core Onboarding (P0)
1. `pan-help` - Entry point, no dependencies
2. `pan-install` - Installation guidance
3. `pan-setup` - Configuration wizard
4. `pan-quickstart` - Combines install + setup
5. `pan-up` / `pan-down` - Service lifecycle
6. `pan-status` - Health overview
7. `pan-plan` - Planning workflow
8. `pan-issue` - Workspace + agent creation

### Phase 2: Configuration (P1)
9. `pan-config` - Config management
10. `pan-tracker` - Tracker setup
11. `pan-projects` - Project management
12. `pan-sync` - Skills sync

### Phase 3: Docker & Networking (P1)
13. Docker templates (all 6)
14. `pan-docker` - Template selection
15. `pan-network` - Networking guidance

### Phase 4: Operations (P1)
16. `pan-approve` - Work approval
17. `pan-tell` / `pan-kill` - Agent management
18. `pan-health` / `pan-diagnose` - Health & troubleshooting

### Phase 5: Advanced (P2)
19. `pan-logs` - Log viewing
20. `pan-rescue` - Recovery operations

## Critical Dependencies

```
pan-help (no deps - start here)
    │
    ├──► pan-install ──► pan-setup ──► pan-quickstart
    │
    ├──► pan-up/pan-down ──► pan-status
    │
    └──► pan-plan ──► pan-issue
                         │
                         ├──► pan-approve
                         ├──► pan-tell
                         └──► pan-kill

Docker templates (can be parallel)
    │
    └──► pan-docker ──► pan-network

pan-config (no deps)
    │
    ├──► pan-tracker
    ├──► pan-projects
    └──► pan-sync

pan-health (no deps)
    │
    └──► pan-diagnose ──► pan-rescue
```

## Current Status

### All Skills Created - Verification Needed

**Discovery (2025-01-20):** All skills for Phases 1-5 exist in the repo. The STATE.md was outdated - Phase 2-5 skills were created but not documented.

### Skills Audit

| Phase | Skills | Repo | Synced | Verified |
|-------|--------|------|--------|----------|
| 1 (P0) | pan-help, install, setup, quickstart, up, down, status, plan, issue | ✅ | ✅ | 🔲 |
| 2 (P1) | pan-config, tracker, projects, sync | ✅ | ❌ | 🔲 |
| 3 (P1) | Docker templates (6) + pan-docker, pan-network | ✅ | ❌ | 🔲 |
| 4 (P1) | pan-approve, tell, kill, health, diagnose | ✅ | ❌ | 🔲 |
| 5 (P2) | pan-logs, pan-rescue | ✅ | ❌ | 🔲 |
| Bonus | pan-code-review, pan-convoy-synthesis | ✅ | ❌ | 🔲 |

### Sync Gap

**Issue:** Phase 2-5 skills exist in `skills/` (repo) but not in `~/.panopticon/skills/` (runtime).

**Root cause:** `pan init` hasn't been run since Phase 2-5 skills were added.

**Fix:** Run `pan init` or manually copy skills, then `pan sync`.

### Remaining Work

| Task | Status |
|------|--------|
| Sync skills to `~/.panopticon/skills/` | 🔲 Pending |
| Sync skills to `~/.claude/skills/` | 🔲 Pending |
| Verify Phase 1 skills work | 🔲 Pending |
| Verify Phase 2 skills work | 🔲 Pending |
| Verify Phase 3 skills (Docker templates) | 🔲 Pending |
| Verify Phase 4 skills work | 🔲 Pending |
| Verify Phase 5 skills work | 🔲 Pending |

## Completed During Planning

| Task | Status | Reference |
|------|--------|-----------|
| Fix planning prompt template to include PRD instruction | ✅ Done | [GitHub #7](https://github.com/eltmon/panopticon-cli/issues/7) |
| Create Phase 1 skills (9 skills) | ✅ Done | Commit `073b520` |

**Fix details:** Updated `src/dashboard/server/index.ts` to include PRD creation instruction in both the main planning prompt and continuation prompt templates.

## Open Questions

None - scope is clear enough to proceed.

## Sample Skill Template

Reference implementation for new skills:

```markdown
---
name: pan-help
description: Overview of all Panopticon commands and capabilities
---

# Panopticon Help

## Overview
[What this skill helps with]

## When to Use
- User asks about Panopticon capabilities
- User is confused about which command to use
- First-time users exploring the system

## Available Commands

### Getting Started
| Command | Description |
|---------|-------------|
| `pan install` | Install dependencies and set up environment |
| `pan up` | Start dashboard and services |
| `pan status` | Check system health |

### Work Management
| Command | Description |
|---------|-------------|
| `pan work issue <id>` | Spawn agent for an issue |
| `pan work status` | Show running agents |

## Workflow
1. Step one
2. Step two
3. Step three

## Troubleshooting
**Problem:** X doesn't work
**Solution:** Do Y
```

## Beads Tasks Summary

### Verification Tasks (Created 2025-01-20)

| Priority | Task ID | Description |
|----------|---------|-------------|
| P0 | panopticon-qe0 | Sync skills to ~/.panopticon/skills/ |
| P0 | panopticon-19b | Sync skills to ~/.claude/skills/ |
| P1 | panopticon-uow | Verify Phase 1 skills (P0): pan-help, install, setup, quickstart, up, down, status, plan, issue |
| P1 | panopticon-e5w | Verify Phase 2 skills (P1): pan-config, tracker, projects, sync |
| P1 | panopticon-cjm | Verify Phase 3: Docker templates + pan-docker, pan-network |
| P1 | panopticon-6kf | Verify Phase 4 skills (P1): pan-approve, tell, kill, health, diagnose |
| P2 | panopticon-v60 | Verify Phase 5 skills (P2): pan-logs, pan-rescue |
| P2 | panopticon-fof | Verify bonus skills: pan-code-review, pan-convoy-synthesis |

### Execution Order

1. **P0 (blocking):** panopticon-qe0 → panopticon-19b (sync must happen first)
2. **P1 (can parallelize):** panopticon-uow, panopticon-e5w, panopticon-cjm, panopticon-6kf
3. **P2 (after P1):** panopticon-v60, panopticon-fof

## References

- Existing skills structure: `~/.panopticon/skills/bug-fix/SKILL.md`
- CLI commands: `pan --help`, `pan work --help`
- Traefik setup: `templates/traefik/`
- PRD: `/home/eltmon/projects/panopticon/docs/PRD.md`
