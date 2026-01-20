# Workspace: feature-pan-17

**Issue:** PAN-17
**Branch:** feature/pan-17
**Path:** /home/eltmon/projects/panopticon/workspaces/feature-pan-17

## URLs (if workspace has Docker)

| Service | URL |
|---------|-----|
| Frontend | https://feature-pan-17.localhost:3000 |
| API | https://api-feature-pan-17.localhost:8080 |


---

## Task Tracking (Beads)

Use beads for persistent task tracking that survives compaction.

```bash
bd ready              # Find unblocked work
bd show <id>          # Get full context
bd update <id> --status in_progress  # Start work
bd comments add <id> "note"  # Add progress (CRITICAL)
bd close <id> --reason "..."  # Complete
bd sync               # Persist to git
```

**ALWAYS** add comments as you work - they survive context compaction.

### Creating Sub-Tasks

```bash
bd create --title "Implement feature X" --parent <parent-id>
```

### Blocking Issues

```bash
bd update <id> --blocked-by <blocker-id>
bd ready  # Will exclude blocked issues
```


---

## Available Commands

| Command | Description |
|---------|-------------|
| `/work-status` | Show all running agents |
| `/work-tell <id> <msg>` | Message an agent |
| `/work-approve <id>` | Approve and merge work |
| `pan workspace list` | List all workspaces |
| `pan skills` | List available skills |

## Skills

Skills are in `~/.panopticon/skills/`. They provide reusable workflows and best practices.

To use a skill, invoke it with `/skill-name` or reference it in your prompt.


---

## Warnings

- **DO NOT** modify files outside this workspace without explicit permission
- **DO NOT** push to main/master branch directly
- **ALWAYS** run tests before marking work complete
- **ALWAYS** add beads comments for long-running tasks
- **ALWAYS** check for existing patterns before introducing new ones
