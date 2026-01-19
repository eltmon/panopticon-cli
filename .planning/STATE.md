# PAN-4: Traefik + Local Domain Setup - STATE

## Issue Summary
Set up Traefik reverse proxy with HTTPS for local Panopticon development.

## Domain Decision

**Issue title says "panopticon.dev" but PRD specifies "pan.localhost"**

The PRD (which is the authoritative source) uses `*.localhost` domains:
- `pan.localhost` - Panopticon dashboard
- `traefik.pan.localhost` - Traefik dashboard
- `feature-{issue}.{project}.localhost` - Workspace frontends
- `api-feature-{issue}.{project}.localhost` - Workspace APIs

**Decision:** Follow the PRD and use `pan.localhost` (not `panopticon.dev`).

**Rationale:**
- `.localhost` is a reserved TLD that resolves to 127.0.0.1 on most systems
- No risk of collision with real domains
- Better cross-platform support
- Consistent with workspace URL patterns already in MYN

## Architecture Decisions (from PRD)

### 1. Traefik Runs in Docker Only
- **Not** containerizing the dashboard itself
- Traefik proxies to host-based services via `host.docker.internal`
- Dashboard continues to run on ports 3001 (frontend) and 3002 (API)

### 2. Directory Structure
```
~/.panopticon/
├── traefik/
│   ├── docker-compose.yml      # Traefik container definition
│   ├── traefik.yml             # Static config
│   ├── dynamic/                # Dynamic configs (per-workspace)
│   │   └── panopticon.yml      # Dashboard routing config
│   └── certs/
│       ├── _wildcard.pan.localhost.pem
│       └── _wildcard.pan.localhost-key.pem
├── certs/                      # mkcert certificates (existing)
└── config.toml                 # Updated with traefik settings
```

### 3. mkcert Certificate Generation
```bash
mkcert "*.pan.localhost" "*.localhost" localhost 127.0.0.1 ::1
```
Generates wildcard certs for:
- `*.pan.localhost` (Panopticon dashboard, Traefik dashboard)
- `*.localhost` (project workspaces like `*.myn.localhost`)

### 4. URL Routing
| URL | Proxies To |
|-----|------------|
| `https://pan.localhost` | `http://host.docker.internal:3001` (dashboard frontend) |
| `https://pan.localhost/api/*` | `http://host.docker.internal:3002` (dashboard API) |
| `https://traefik.pan.localhost:8080` | Traefik dashboard |

### 5. DNS Resolution

#### Linux/macOS
Add to `/etc/hosts`:
```
127.0.0.1 pan.localhost traefik.pan.localhost
```
Note: Only static entries needed. Wildcard `*.localhost` resolves automatically on modern systems.

#### WSL2/Windows
dnsmasq for wildcard DNS + Windows hosts sync:
```bash
# In /etc/dnsmasq.d/panopticon.conf
address=/localhost/127.0.0.1
```

### 6. CLI Integration

New commands:
- `pan install` - Enhanced to set up Traefik (already has mkcert setup)
- `pan up` - Start Traefik along with dashboard
- `pan down` - Stop Traefik along with dashboard

Config additions to `~/.panopticon/config.toml`:
```toml
[traefik]
enabled = true
dashboard_port = 8080
domain = "pan.localhost"
```

### 7. Minimal Install (--minimal flag)
Skip Traefik entirely, use port-based routing:
- `http://localhost:3001` (dashboard frontend)
- `http://localhost:3002` (dashboard API)

## What's In Scope

1. Traefik docker-compose.yml and configuration
2. mkcert certificate generation for wildcard domains
3. Static Traefik config (traefik.yml)
4. Dynamic config for Panopticon dashboard routing
5. Update `pan install` to set up Traefik
6. Update `pan up` and `pan down` to manage Traefik container
7. DNS/hosts file instructions and helper scripts
8. Update config.toml schema for traefik settings

## What's Out of Scope

1. Workspace-specific dynamic routing (that's for workspace create/start)
2. Project-specific routing (e.g., `*.myn.localhost`)
3. Windows native support (WSL2 only for now)
4. Automatic `/etc/hosts` modification (provide instructions + optional helper)

## Open Questions

None - PRD is comprehensive enough to proceed.

## Implementation Order

| # | Task | Beads ID | Depends On |
|---|------|----------|------------|
| 1 | Create Traefik configuration templates | `panopticon-1dg` | - |
| 2 | Implement mkcert wildcard certificate generation | `panopticon-5aw` | #1 |
| 3 | Update pan install to set up Traefik | `panopticon-6cl` | #1, #2 |
| 4 | Update pan up/down to manage Traefik container | `panopticon-8ca` | #3 |
| 5 | Add traefik section to config.toml schema | `panopticon-dbt` | - |
| 6 | Document DNS/hosts setup for each platform | `panopticon-qpo` | #4 |
| 7 | End-to-end test: pan install && pan up | `panopticon-d0o` | #4, #6 |

## Critical Path

```
1. Traefik configs (panopticon-1dg)
   ├──► 2. mkcert certs (panopticon-5aw)
   │       └──► 3. pan install (panopticon-6cl)
   │               └──► 4. pan up/down (panopticon-8ca)
   │                       └──► 7. E2E test (panopticon-d0o)
   │
   └──► 5. config.toml schema (panopticon-dbt) [parallel]

6. Docs (panopticon-qpo) can start after #4
```
