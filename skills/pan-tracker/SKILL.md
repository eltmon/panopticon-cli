---
name: pan-tracker
description: Configure issue tracker integration (Linear, GitHub, GitLab)
triggers:
  - pan tracker
  - configure tracker
  - setup linear
  - setup github issues
  - connect issue tracker
  - tracker integration
allowed-tools:
  - Bash
  - Read
  - Edit
---

# Issue Tracker Configuration

## Overview

This skill guides you through configuring issue tracker integration with Panopticon. Supported trackers include Linear, GitHub Issues, and GitLab Issues.

## When to Use

- Setting up a new tracker integration
- Switching between trackers
- Configuring project-to-tracker mappings
- Troubleshooting tracker connectivity

## Supported Trackers

| Tracker | Status | Configuration |
|---------|--------|---------------|
| **Linear** | Full support | API key in `~/.panopticon.env` |
| **GitHub Issues** | Full support | Token + repo config in `~/.panopticon.env` |
| **GitLab Issues** | Partial | Token + URL in `~/.panopticon.env` |

## Linear Setup

### 1. Get Your API Key

1. Go to Linear → Settings → API
2. Click "Personal API keys"
3. Click "Create key"
4. Copy the key (starts with `lin_api_`)

### 2. Configure Panopticon

```bash
# Add to ~/.panopticon.env
echo "LINEAR_API_KEY=lin_api_your_key_here" >> ~/.panopticon.env
```

### 3. Map Linear Projects to Local Paths

Create/edit `~/.panopticon/project-mappings.json`:

```json
[
  {
    "linearProjectId": "abc123",
    "linearProjectName": "My Project",
    "linearPrefix": "PRJ",
    "localPath": "/home/user/projects/myproject"
  }
]
```

To find your Linear project ID:
```bash
# Use the dashboard or Linear API
# Project ID is in the URL when viewing a project
```

### 4. Verify Setup

```bash
pan work list
# Should show issues from your Linear projects
```

## GitHub Issues Setup

### 1. Get Your Token

```bash
# If you have gh CLI installed:
gh auth token

# Or create a Personal Access Token at:
# GitHub → Settings → Developer settings → Personal access tokens
# Required scopes: repo, read:org
```

### 2. Configure Panopticon

```bash
cat >> ~/.panopticon.env << 'EOF'
GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPOS=owner/repo:PREFIX
GITHUB_LOCAL_PATHS=owner/repo=/path/to/local/repo
EOF
```

**Format explanation:**
- `GITHUB_REPOS`: Comma-separated list of `owner/repo:PREFIX` (PREFIX is optional, defaults to REPO uppercase)
- `GITHUB_LOCAL_PATHS`: Comma-separated list of `owner/repo=/local/path`

### 3. Example Multi-Repo Setup

```bash
GITHUB_REPOS=myorg/frontend:FE,myorg/backend:BE,myorg/infra:INF
GITHUB_LOCAL_PATHS=myorg/frontend=/home/user/frontend,myorg/backend=/home/user/backend,myorg/infra=/home/user/infra
```

### 4. Create Required Labels

Panopticon uses labels to track issue state:
```bash
# Create labels for your repo
gh label create "planning" --description "Issue is in planning phase" --color "a855f7"
gh label create "in-progress" --description "Work is actively being done" --color "3b82f6"
gh label create "done" --description "Work completed" --color "22c55e"
```

### 5. Verify Setup

```bash
pan work list
# Should show issues from your GitHub repos
```

## GitLab Issues Setup

### 1. Get Your Token

1. Go to GitLab → Preferences → Access Tokens
2. Create a token with `api` scope
3. Copy the token (starts with `glpat-`)

### 2. Configure Panopticon

```bash
cat >> ~/.panopticon.env << 'EOF'
GITLAB_TOKEN=glpat-your_token_here
GITLAB_URL=https://gitlab.com
EOF
```

For self-hosted GitLab, change `GITLAB_URL` to your instance URL.

## Multiple Trackers

You can configure multiple trackers simultaneously. Panopticon will aggregate issues from all configured trackers.

```bash
# ~/.panopticon.env with multiple trackers
LINEAR_API_KEY=lin_api_xxxxx
GITHUB_TOKEN=ghp_xxxxx
GITHUB_REPOS=myorg/repo:GH
GITHUB_LOCAL_PATHS=myorg/repo=/home/user/repo
```

## Workflow

1. **Choose your tracker(s)**: Linear, GitHub, or GitLab
2. **Get API credentials**: Follow the steps above for your tracker
3. **Add to ~/.panopticon.env**: Configure tokens and repos
4. **Set up mappings**: Map tracker projects to local paths
5. **Verify**: Run `pan work list` to confirm connectivity
6. **Restart dashboard**: `pan down && pan up`

## Troubleshooting

**Problem:** `pan work list` shows no issues
**Solution:**
- Check API key is correct in `~/.panopticon.env`
- Verify project mappings in `~/.panopticon/project-mappings.json`
- Restart dashboard: `pan down && pan up`

**Problem:** GitHub issues not syncing state
**Solution:** Ensure required labels exist (`planning`, `in-progress`, `done`)

**Problem:** Wrong project path for issues
**Solution:** Check `GITHUB_LOCAL_PATHS` or `project-mappings.json` mappings

## Related Skills

- `/pan:config` - General configuration
- `/pan:projects` - Manage local projects
- `/pan:status` - Check system health
