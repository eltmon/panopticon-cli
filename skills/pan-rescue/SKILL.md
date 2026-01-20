---
name: pan-rescue
description: Recover work from crashed or stopped agents
triggers:
  - pan rescue
  - recover agent work
  - agent crashed
  - rescue work
  - recover progress
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
---

# Rescue Agent Work

## Overview

This skill guides you through recovering work from agents that crashed, were killed, or stopped unexpectedly. It helps you salvage uncommitted changes, understand where the agent left off, and resume work.

## When to Use

- Agent crashed or was forcefully terminated
- Context window exceeded and agent stopped
- System reboot interrupted agent
- Need to recover partially completed work
- Agent made progress but didn't commit

## Quick Recovery

```bash
# Find the workspace
cd /path/to/workspaces/ISSUE-123

# Check for uncommitted work
git status
git diff

# Read agent's last state
cat .planning/STATE.md
```

## Recovery Workflow

### 1. Locate the Workspace

```bash
# Default workspace location
ls -la $WORKSPACE_ROOT/

# Or find by issue ID
find ~ -type d -name "*ISSUE-123*" 2>/dev/null

# Check recent workspaces
ls -lt $WORKSPACE_ROOT/ | head -10
```

### 2. Assess the Damage

```bash
cd /path/to/workspace/ISSUE-123

# Check git status
git status

# See uncommitted changes
git diff

# See staged changes
git diff --cached

# Check for stashed work
git stash list
```

### 3. Read Agent's State

```bash
# Planning state (most important!)
cat .planning/STATE.md

# Agent's notes
cat .planning/NOTES.md 2>/dev/null

# Issue context
cat .planning/CLAUDE.md 2>/dev/null
```

### 4. Review Agent's Output

```bash
# If tmux session still exists
tmux capture-pane -t agent-ISSUE-123 -p -S - > agent-output.txt

# Look for last actions
tail -100 agent-output.txt

# Find where it stopped
grep -i "error\|crash\|exception" agent-output.txt
```

### 5. Salvage Uncommitted Work

**Option A: Commit the changes**
```bash
# If work looks good
git add -A
git commit -m "WIP: Recovered from crashed agent

Partial implementation of ISSUE-123.
Agent stopped at: [describe point]"
```

**Option B: Stash for later**
```bash
# Save but don't commit
git stash save "Recovered work from ISSUE-123"
```

**Option C: Create patch**
```bash
# Export as patch file
git diff > recovered-work.patch
git diff --cached >> recovered-work.patch
```

### 6. Resume Work

**Option A: Spawn new agent**
```bash
# Resume with fresh agent
pan work issue ISSUE-123

# Agent will read STATE.md and continue
```

**Option B: Continue manually**
```bash
# Work in the existing workspace
cd /path/to/workspace/ISSUE-123

# Read the context
cat .planning/STATE.md

# Continue implementation
```

**Option C: Start fresh**
```bash
# If work is unsalvageable
rm -rf /path/to/workspace/ISSUE-123
pan work issue ISSUE-123
```

## Common Scenarios

### Agent Ran Out of Context

```bash
# Agent stopped mid-task due to context window
# STATE.md should be current

cat .planning/STATE.md
# Look for "Completed" and "Next steps" sections

# Resume with new agent
pan work issue ISSUE-123
```

### System Crash/Reboot

```bash
# Workspace should be intact
git status

# Check for partial writes
find . -name "*.swp" -o -name "*~"

# Clean up editor temp files
rm -f **/*.swp **/*~

# Verify file integrity
git diff  # Review changes
```

### API Rate Limit

```bash
# Agent may have stopped due to rate limits
# Check the output
grep -i "rate\|limit\|429" agent-output.txt

# Wait and resume
sleep 60
pan work issue ISSUE-123
```

### Build/Test Failure Loop

```bash
# Agent might be stuck in failure loop
# Check recent commits
git log --oneline -10

# Revert problematic changes
git revert HEAD

# Or reset to known good state
git log --oneline -20
git reset --hard <good-commit>
```

## Update STATE.md Before Resuming

If STATE.md is outdated, update it:

```markdown
# Current State

## Last Known Progress
- Agent stopped at: [describe]
- Completed: [list completed items]
- In progress: [what was being worked on]

## Uncommitted Changes
- [list files with uncommitted changes]

## Next Steps
1. [what the next agent should do first]
2. [subsequent steps]

## Notes
- [any important context for the next agent]
```

## Recovery Checklist

- [ ] Located workspace directory
- [ ] Checked git status for uncommitted work
- [ ] Read STATE.md for context
- [ ] Captured agent output (if session exists)
- [ ] Decided: commit, stash, or discard changes
- [ ] Updated STATE.md with current status
- [ ] Ready to resume (new agent or manual)

## Preventing Data Loss

### Best Practices for Agents

1. **Frequent commits** - Commit working code often
2. **Update STATE.md** - Keep state file current
3. **Small PRs** - Don't let changes accumulate
4. **Test before commit** - Ensure code works

### Monitoring

```bash
# Set up periodic state saves
watch -n 60 'cd /workspace && git stash save "auto-backup-$(date +%H%M)"'

# Or use git auto-commit hooks
```

## Related Skills

- `/pan:logs` - View agent logs
- `/pan:kill` - Stop agents gracefully
- `/pan:tell` - Request state save before stopping
