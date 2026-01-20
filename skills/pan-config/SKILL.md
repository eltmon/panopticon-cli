---
name: pan-config
description: View and edit Panopticon configuration
triggers:
  - pan config
  - panopticon config
  - configure panopticon
  - panopticon settings
  - edit panopticon config
allowed-tools:
  - Bash
  - Read
  - Edit
---

# Panopticon Configuration

## Overview

This skill guides you through viewing and editing Panopticon configuration. Configuration is stored in `~/.panopticon/config.toml` and `~/.panopticon.env`.

## When to Use

- User wants to view current configuration
- User needs to change settings (sync targets, backup options, etc.)
- User wants to configure API keys or tokens
- User needs to set up tracker integration

## Configuration Files

| File | Purpose | Format |
|------|---------|--------|
| `~/.panopticon/config.toml` | Main configuration | TOML |
| `~/.panopticon.env` | API keys and secrets | ENV |
| `~/.panopticon/projects.json` | Registered projects | JSON |
| `~/.panopticon/project-mappings.json` | Tracker → project mappings | JSON |

## View Current Configuration

```bash
# View main config
cat ~/.panopticon/config.toml

# View environment/secrets (careful - contains API keys)
cat ~/.panopticon.env

# View registered projects
cat ~/.panopticon/projects.json

# View project mappings
cat ~/.panopticon/project-mappings.json
```

## Configuration Options

### Main Config (~/.panopticon/config.toml)

```toml
[sync]
# Which AI tools to sync skills to
targets = ["claude", "codex", "cursor", "gemini"]

# Create backup before syncing
backup_before_sync = true

[dashboard]
# Dashboard port (default: 3010)
port = 3010

# API port (default: 3011)
api_port = 3011

[agent]
# Default model for agents
default_model = "sonnet"

# Default runtime
default_runtime = "claude"

# Health check interval (seconds)
health_check_interval = 30
```

### Environment Variables (~/.panopticon.env)

```bash
# Linear API key (for issue tracking)
LINEAR_API_KEY=lin_api_xxxxx

# GitHub configuration
GITHUB_TOKEN=ghp_xxxxx
GITHUB_REPOS=owner/repo:PREFIX,owner/repo2:PREFIX2
GITHUB_LOCAL_PATHS=owner/repo=/path/to/local,owner/repo2=/path2

# Optional: GitLab configuration
GITLAB_TOKEN=glpat-xxxxx
GITLAB_URL=https://gitlab.com
```

## Common Configuration Tasks

### Add a New Sync Target

```bash
# Edit config.toml and add to targets array
# Valid targets: claude, codex, cursor, gemini
```

### Configure Linear Integration

```bash
# Get your Linear API key from:
# Settings → API → Personal API keys → Create key

# Add to ~/.panopticon.env:
echo "LINEAR_API_KEY=lin_api_your_key_here" >> ~/.panopticon.env
```

### Configure GitHub Integration

```bash
# Get token: gh auth token
# Or create at: Settings → Developer settings → Personal access tokens

# Add to ~/.panopticon.env:
cat >> ~/.panopticon.env << 'EOF'
GITHUB_TOKEN=your_token_here
GITHUB_REPOS=owner/repo:PREFIX
GITHUB_LOCAL_PATHS=owner/repo=/path/to/local
EOF
```

### Change Dashboard Ports

```bash
# Edit ~/.panopticon/config.toml
# Change port and api_port values
# Restart dashboard: pan down && pan up
```

## Workflow

1. **View current config**: `cat ~/.panopticon/config.toml`
2. **Identify what to change**: Determine which setting needs modification
3. **Edit the appropriate file**: Use your editor to modify
4. **Restart services if needed**: `pan down && pan up`
5. **Verify changes**: `pan doctor` or `pan status`

## Troubleshooting

**Problem:** Changes not taking effect
**Solution:** Restart the dashboard with `pan down && pan up`

**Problem:** API key not working
**Solution:** Verify the key is correct and has proper permissions. Check `~/.panopticon.env` for typos.

**Problem:** Sync targets not working
**Solution:** Run `pan doctor` to check if target directories exist. Run `pan sync --dry-run` to preview.

## Related Skills

- `/pan:tracker` - Configure issue tracker integration
- `/pan:projects` - Manage registered projects
- `/pan:sync` - Sync skills to AI tools
