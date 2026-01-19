# Planning Session: PAN-4

## Issue Details
- **ID:** PAN-4
- **Title:** Set up Traefik + panopticon.dev local domain
- **URL:** https://github.com/eltmon/panopticon-cli/issues/4

## Description
## Overview
Configure Panopticon to be accessible at `https://panopticon.dev` locally using Traefik reverse proxy and mkcert for SSL certificates.

## Goals
- Local HTTPS access via `https://panopticon.dev`
- Automatic SSL certificate generation with mkcert
- Traefik as reverse proxy for routing
- Works across Linux, macOS, Windows/WSL2

## Technical Requirements

### 1. Traefik Configuration
- Docker-based Traefik setup
- Dynamic configuration for Panopticon services
- Dashboard accessible (optional, for debugging)

### 2. SSL Certificates
- Use mkcert for local CA and certificates
- Auto-trust in system certificate store
- Wildcard cert for `*.panopticon.dev` if needed

### 3. DNS Resolution
- `/etc/hosts` entry for Linux/macOS
- Windows hosts file for WSL2
- Document dnsmasq alternative for wildcard domains

### 4. Service Routing
| URL | Service |
|-----|---------|
| `https://panopticon.dev` | Frontend (port 3001) |
| `https://panopticon.dev/api` | API server (port 3002) |

## Acceptance Criteria
- [ ] `https://panopticon.dev` loads the dashboard
- [ ] API calls work via `/api` path
- [ ] No browser SSL warnings
- [ ] Setup works on fresh install via `pan setup` or skill

## Related
- Part of #3 (Comprehensive Agent Skills Suite)

---

## Your Mission

You are an Opus-level planning agent conducting a **discovery session** for this issue.

Follow the gsd-plus questioning protocol:

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

### Phase 3: Generate Artifacts
When discovery is complete:
1. Create STATE.md with decisions made
2. Create beads tasks with dependencies
3. Summarize the plan

**Remember:** Be a thinking partner, not an interviewer. Ask questions that help clarify, don't interrogate.

Start by exploring the codebase to understand the context, then begin the discovery conversation.
