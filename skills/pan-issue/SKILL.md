---
name: pan-issue
description: Create workspace and spawn autonomous agent for an issue
triggers:
  - work on issue
  - create workspace
  - spawn agent
  - pan work issue
  - start working on
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

# Create Workspace and Spawn Agent

## Overview

This skill guides you through creating an isolated workspace for an issue and spawning an autonomous AI agent to work on it. The agent will work independently in a tmux session with full access to code, Docker containers, and development tools.

## When to Use

- User wants to start working on an issue
- User wants AI agent to implement a feature
- User has an issue ready for development
- User wants to create isolated development environment
- User asks "how do I start working on this issue?"

## What This Does

`pan work issue <id>` creates a complete development environment:

1. **Workspace directory** - Isolated clone of codebase
2. **Git branch** - Feature branch for the issue
3. **Docker containers** - Application services (if configured)
4. **tmux session** - Interactive terminal for the agent
5. **AI agent** - Autonomous assistant that implements the issue
6. **Beads tracking** - Persistent task tracking (if enabled)

## Basic Usage

```bash
# Create workspace and spawn agent for issue
pan work issue PAN-3

# Create workspace with existing plan
pan work issue PAN-3 --with-plan

# Create workspace with specific branch
pan work issue PAN-3 --branch feature/custom-name

# Create workspace without spawning agent
pan workspace create PAN-3
```

## Complete Workflow

### Step 1: Verify Prerequisites

Before creating workspace:

```bash
# Check Panopticon is running
pan status

# Verify issue exists
pan work list | grep PAN-3

# Check Docker is running
docker ps

# Verify disk space
df -h ~/panopticon/workspaces/
```

### Step 2: Optional - Create Plan First

For complex issues, plan first:

```bash
# Create execution plan
pan work plan PAN-3

# Review plan in dashboard or:
cat ~/.panopticon/planning/PAN-3/PLANNING.md

# If approved, proceed to create workspace
```

### Step 3: Create Workspace and Spawn Agent

```bash
pan work issue PAN-3
```

**What happens (detailed):**

1. **Fetch issue details** from Linear/GitHub/GitLab
   - Issue title, description, labels
   - Acceptance criteria
   - Related issues/PRs

2. **Create workspace directory**
   ```
   ~/panopticon/workspaces/feature-pan-3/
   ├── .git/              # Git repository
   ├── src/               # Source code
   ├── docker-compose.yml # Docker services (if using Docker)
   ├── CLAUDE.md          # Workspace instructions for agent
   ├── PLANNING.md        # Execution plan (if created)
   └── .panopticon/       # Workspace metadata
   ```

3. **Create feature branch**
   ```bash
   # Branch name based on issue type and ID
   git checkout -b feature/pan-3  # For features
   git checkout -b bug/pan-3      # For bugs
   git checkout -b refactor/pan-3 # For refactors
   ```

4. **Start Docker containers** (if configured)
   ```bash
   # Services defined in Docker template
   docker-compose up -d
   # Examples: app, database, redis, etc.
   ```

5. **Create tmux session**
   ```bash
   tmux new-session -d -s agent-PAN-3
   ```

6. **Spawn AI agent** in tmux session
   - Agent runs Claude Code CLI
   - Full access to Read, Write, Edit, Bash tools
   - Can run tests, commit code, ask questions
   - Works autonomously toward issue completion

7. **Initialize beads tracking** (if enabled)
   ```bash
   # Create beads database for task tracking
   bd init
   # Agent can use bd to track sub-tasks
   ```

**Expected output:**
```
✓ Fetched issue PAN-3 from Linear
✓ Created workspace: ~/panopticon/workspaces/feature-pan-3
✓ Created branch: feature/pan-3
✓ Started Docker containers (app, db, redis)
✓ Created tmux session: agent-PAN-3
✓ Spawned AI agent

Workspace: ~/panopticon/workspaces/feature-pan-3
Branch: feature/pan-3
Session: agent-PAN-3
Dashboard: http://localhost:3001/agents/PAN-3

Monitor agent:
  pan status              # Check status
  pan work tell PAN-3 "message"  # Send message
  tmux attach -t agent-PAN-3     # Watch live (Ctrl+b d to detach)
```

### Step 4: Monitor Agent

```bash
# Check agent status
pan status

# Watch in dashboard
# Visit http://localhost:3001/agents/PAN-3

# Attach to tmux session
tmux attach -t agent-PAN-3
# Press Ctrl+b d to detach

# View recent output
tmux capture-pane -t agent-PAN-3 -p | tail -20
```

### Step 5: Interact with Agent (if needed)

```bash
# Send message to agent
pan work tell PAN-3 "Make sure to add tests"

# Ask agent a question
pan work tell PAN-3 "What's your current progress?"

# Give guidance
pan work tell PAN-3 "Use the UserService pattern from src/services/"
```

### Step 6: Review Completed Work

When agent finishes:

```bash
# Check pending work
pan work pending

# Review in dashboard
# Visit http://localhost:3001/pending

# Review code changes
cd ~/panopticon/workspaces/feature-pan-3
git diff main

# Review tests
# Check test output in agent session
```

### Step 7: Approve or Request Changes

```bash
# If work looks good, approve and merge
pan work approve PAN-3

# If changes needed, send feedback
pan work tell PAN-3 "Please add error handling for null users"

# If starting over, kill and restart
pan work kill PAN-3
pan work issue PAN-3
```

## Workspace Configuration

### Default Workspace Settings

Edit `~/.panopticon.env`:

```env
# Where workspaces are created
WORKSPACE_ROOT=~/panopticon/workspaces

# Default Docker template (spring-boot, react-vite, nextjs, etc.)
DEFAULT_DOCKER_TEMPLATE=spring-boot

# Branch naming pattern
BRANCH_PREFIX=feature  # Creates feature/<issue-id>

# Enable beads tracking in workspaces
WORKSPACE_BEADS=true

# Auto-run tests before marking complete
AUTO_TEST=true
```

### Per-Issue Docker Template

```bash
# Use specific Docker template for an issue
pan work issue PAN-3 --template react-vite

# Available templates:
# - spring-boot (Java/Spring + PostgreSQL + Redis)
# - react-vite (React + Vite + hot-reload)
# - nextjs (Next.js + app router)
# - dotnet (.NET Core + SQL Server)
# - python-fastapi (FastAPI + uvicorn)
# - monorepo (Frontend + backend combo)
```

### Workspace Isolation

Each workspace is completely isolated:

- ✅ **Separate git branch** - No conflicts with main
- ✅ **Separate Docker containers** - Own database, services
- ✅ **Separate tmux session** - Independent agent
- ✅ **Separate dependencies** - Own node_modules, packages
- ✅ **Separate environment** - Custom .env files

You can run multiple agents in parallel:
```bash
pan work issue PAN-3  # Agent working on auth
pan work issue PAN-5  # Agent working on billing
pan work issue PAN-7  # Agent working on dashboard
```

## Advanced Usage

### Create Workspace Without Agent

```bash
# Just create workspace, no agent
pan workspace create PAN-3

# Then spawn agent later
cd ~/panopticon/workspaces/feature-pan-3
claude --config ~/.panopticon/claude.config.json
```

### Create Workspace With Plan

```bash
# Plan first
pan work plan PAN-3

# Then create workspace with plan context
pan work issue PAN-3 --with-plan

# Agent will have PLANNING.md as reference
```

### Custom Branch Name

```bash
# Use custom branch name
pan work issue PAN-3 --branch custom/my-feature

# Or set via env var
BRANCH_NAME=custom/my-feature pan work issue PAN-3
```

### Resume Existing Workspace

```bash
# List existing workspaces
pan workspace list

# If workspace exists, agent will resume
pan work issue PAN-3

# Or explicitly resume
pan work issue PAN-3 --resume
```

## Troubleshooting

### Workspace creation fails

**Problem:** `pan work issue` fails with error

**Solutions:**
```bash
# Check issue exists
pan work list | grep PAN-3

# Check disk space
df -h ~/panopticon/workspaces/

# Check Docker is running
docker ps

# Check for port conflicts
pan workspace list  # See what ports are in use

# Try with verbose output
pan work issue PAN-3 --verbose
```

### Docker containers won't start

**Problem:** Workspace created but containers failed

**Solutions:**
```bash
# Check Docker daemon
docker ps

# Check container logs
cd ~/panopticon/workspaces/feature-pan-3
docker-compose logs

# Check port conflicts
lsof -i :8080
lsof -i :5432

# Restart containers
docker-compose down
docker-compose up -d
```

### Agent session not starting

**Problem:** Workspace created but no tmux session

**Solutions:**
```bash
# Check tmux is installed
which tmux

# List tmux sessions
tmux list-sessions

# Check agent logs
cat ~/.panopticon/logs/agent-PAN-3.log

# Manually start session
cd ~/panopticon/workspaces/feature-pan-3
tmux new-session -s agent-PAN-3
claude
```

### Workspace already exists

**Problem:** `pan work issue` says workspace exists

**Solutions:**
```bash
# Option 1: Resume existing workspace
pan work issue PAN-3 --resume

# Option 2: Destroy and recreate
pan workspace destroy PAN-3
pan work issue PAN-3

# Option 3: Use existing workspace manually
cd ~/panopticon/workspaces/feature-pan-3
tmux attach -t agent-PAN-3
```

### Branch already exists

**Problem:** Error: branch `feature/pan-3` already exists

**Solutions:**
```bash
# Check if branch has work
cd ~/panopticon/workspaces/feature-pan-3
git status
git log

# If branch is clean, delete and retry
git checkout main
git branch -D feature/pan-3
pan work issue PAN-3

# If branch has work, use different branch name
pan work issue PAN-3 --branch feature/pan-3-v2
```

### Out of disk space

**Problem:** Workspace creation fails with disk space error

**Solutions:**
```bash
# Check disk usage
df -h ~/panopticon/workspaces/

# Clean up old workspaces
pan workspace list
pan workspace destroy <old-workspace-id>

# Clean Docker resources
docker system prune -a

# Move workspace root to larger disk
# Edit ~/.panopticon.env:
WORKSPACE_ROOT=/mnt/large-disk/panopticon/workspaces
```

## Workspace Directory Structure

After `pan work issue PAN-3`:

```
~/panopticon/workspaces/feature-pan-3/
├── .git/                    # Git repository
├── .panopticon/             # Workspace metadata
│   ├── issue.json          # Issue details from tracker
│   ├── workspace.json      # Workspace configuration
│   └── agent.json          # Agent state
├── src/                     # Source code (cloned from main)
├── tests/                   # Tests
├── docker-compose.yml       # Docker services (if using Docker)
├── .env                     # Environment variables (workspace-specific)
├── CLAUDE.md                # Instructions for agent
├── PLANNING.md              # Execution plan (if created with pan work plan)
├── .beads/                  # Beads tracking (if enabled)
│   └── workspace.db        # Task database
└── README.md                # Project README
```

## Agent Capabilities

The spawned agent can:

### Code Operations
- ✅ Read any file
- ✅ Edit files
- ✅ Create new files
- ✅ Search codebase (Glob, Grep)
- ✅ Understand architecture

### Development Operations
- ✅ Run tests
- ✅ Run build
- ✅ Start dev server
- ✅ Run linters
- ✅ Format code

### Git Operations
- ✅ Make commits
- ✅ Create branches
- ✅ View diffs
- ✅ Resolve conflicts

### Docker Operations
- ✅ Start/stop containers
- ✅ View logs
- ✅ Run database migrations
- ✅ Execute commands in containers

### Task Management
- ✅ Break down work into sub-tasks (using beads)
- ✅ Track progress
- ✅ Update status

### Communication
- ✅ Ask clarifying questions
- ✅ Report progress
- ✅ Explain decisions

## Best Practices

### 1. Use Planning for Complex Issues

```bash
# For complex issues, plan first
pan work plan PAN-3
# Review and approve plan
pan work issue PAN-3 --with-plan
```

### 2. Monitor Agent Progress

```bash
# Check status regularly
watch -n 10 pan status

# Or use dashboard
# http://localhost:3001/agents/PAN-3
```

### 3. Provide Context to Agent

```bash
# Send helpful context early
pan work tell PAN-3 "Follow the pattern in src/services/UserService.ts"
pan work tell PAN-3 "Make sure all tests pass before committing"
```

### 4. Run Multiple Agents in Parallel

```bash
# Agents work independently
pan work issue PAN-3  # Feature work
pan work issue PAN-5  # Bug fix
pan work issue PAN-7  # Refactoring

# Monitor all
pan status
```

### 5. Clean Up Completed Workspaces

```bash
# After approving work, clean up
pan workspace destroy PAN-3

# Or keep for reference (disk permitting)
```

## Next Steps

After spawning agent:

1. **Monitor progress**: `pan status` or dashboard
2. **Review work**: When agent completes, `pan work pending`
3. **Approve**: `pan work approve PAN-3`
4. **Clean up**: `pan workspace destroy PAN-3`

## Related Skills

- `/pan-plan` - Create execution plan before implementation
- `/pan-status` - Monitor running agents
- `/pan-approve` - Approve completed work (coming soon)
- `/pan-tell` - Send messages to agents (coming soon)
- `/pan-kill` - Stop agents (coming soon)
- `/feature-work` - Feature implementation workflow
- `/bug-fix` - Bug fixing workflow

## More Information

- Workspace root: `~/panopticon/workspaces/` (configurable)
- Dashboard: http://localhost:3001/agents/<issue-id>
- Run `pan work issue --help` for more options
- Run `pan workspace --help` for workspace management
