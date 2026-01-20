# Planning Session: PAN-3

## CRITICAL: PLANNING ONLY - NO IMPLEMENTATION

**YOU ARE IN PLANNING MODE. DO NOT:**
- Write or modify any code files (except STATE.md)
- Run implementation commands (npm install, docker compose, make, etc.)
- Create actual features or functionality
- Start implementing the solution

**YOU SHOULD ONLY:**
- Ask clarifying questions (use AskUserQuestion tool)
- Explore the codebase to understand context (read files, grep)
- Generate planning artifacts:
  - STATE.md (decisions, approach, architecture)
  - Beads tasks (via `bd create`)
  - PRD file at `docs/prds/active/{issue-id}-plan.md` (copy of STATE.md, required for dashboard)
- Present options and tradeoffs for the user to decide

When planning is complete, STOP and tell the user: "Planning complete - click Done when ready to hand off to an agent for implementation."

---

## Issue Details
- **ID:** PAN-3
- **Title:** Comprehensive Agent Skills Suite with Docker & Networking Support
- **URL:** https://github.com/eltmon/panopticon-cli/issues/3

## Description
# Comprehensive Agent Skills Suite for Panopticon

## Overview

Create a full suite of agent skills that guide users through every aspect of Panopticon - from installation to daily operations to troubleshooting. These skills should make Panopticon accessible to developers regardless of their infrastructure experience.

**Key Principle:** The co-mayor agent should be able to guide any developer through any Panopticon operation conversationally.

---

## Part 1: Skill Categories

### 🚀 Getting Started Skills

| Skill | Description | Priority |
|-------|-------------|----------|
| `pan:help` | Overview of all commands, entry point for discovery | P0 |
| `pan:install` | Guide through installation (npm, dependencies, env setup) | P0 |
| `pan:setup` | First-time setup wizard (configure projects, trackers, API keys) | P0 |
| `pan:quickstart` | Fast-track: install + setup + first workspace in one flow | P0 |

### ⚙️ Configuration Skills

| Skill | Description | Priority |
|-------|-------------|----------|
| `pan:config` | View/edit Panopticon configuration | P1 |
| `pan:tracker` | Configure issue tracker integration (Linear/GitHub/GitLab/Jira) | P1 |
| `pan:states` | Configure state mappings (set up "In Planning" etc.) | P1 |
| `pan:projects` | Add/remove/configure managed projects | P1 |
| `pan:docker` | Configure Docker templates for different app types | P1 |
| `pan:network` | Configure networking, Traefik, local domains | P1 |

### 🛠️ Work Orchestration Skills

| Skill | Description | Priority |
|-------|-------------|----------|
| `pan:plan` | Full planning workflow with AI discovery | P0 |
| `pan:issue` | Create workspace + spawn agent for an issue | P0 |
| `pan:status` | Check all running agents, workspaces, health | P0 |
| `pan:approve` | Review + approve agent work, merge MR | P1 |
| `pan:tell` | Send message to a running agent | P1 |
| `pan:kill` | Stop a running agent | P1 |

### 📊 Dashboard Skills

| Skill | Description | Priority |
|-------|-------------|----------|
| `pan:up` | Start Panopticon dashboard + API server + Traefik | P0 |
| `pan:down` | Graceful shutdown of all services | P0 |

### 🔧 Troubleshooting Skills

| Skill | Description | Priority |
|-------|-------------|----------|
| `pan:health` | System health check (docker, git, APIs, agents) | P1 |
| `pan:diagnose` | Interactive troubleshooting for common issues | P1 |
| `pan:logs` | View logs from agents, dashboard, API | P2 |
| `pan:rescue` | Recover stuck agents, clean up orphaned workspaces | P2 |

### 🧩 Extension Skills

| Skill | Description | Priority |
|-------|-------------|----------|
| `pan:skill-create` | Create a new Panopticon skill | P2 |
| `pan:sync` | Sync skills/commands to Claude Code config | P1 |

---

## Part 2: Docker Configuration Templates

### Supported Application Types

Each app type needs a Docker template with:
- Development Dockerfile
- docker-compose.yml for workspace
- Hot-reload configuration
- Database/service dependencies
- Environment variable management

#### Java/Spring Boot
```yaml
# Template: spring-boot
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src
      - ~/.m2:/root/.m2  # Maven cache
    ports:
      - "${PORT:-8080}:8080"
      - "5005:5005"  # Debug port
    environment:
      - SPRING_PROFILES_ACTIVE=dev
      - JAVA_TOOL_OPTIONS=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005
    depends_on:
      - postgres
      - redis
  
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: ${DB_NAME:-app}
      POSTGRES_USER: ${DB_USER:-dev}
      POSTGRES_PASSWORD: ${DB_PASS:-dev}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
```

#### React (Vite)
```yaml
# Template: react-vite
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src
      - ./public:/app/public
      - /app/node_modules  # Anonymous volume for node_modules
    ports:
      - "${PORT:-3000}:3000"
    environment:
      - VITE_API_URL=${API_URL:-http://localhost:8080}
    command: npm run dev -- --host 0.0.0.0
```

#### Next.js
```yaml
# Template: nextjs
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src
      - ./pages:/app/pages
      - ./app:/app/app
      - ./public:/app/public
      - /app/node_modules
      - /app/.next
    ports:
      - "${PORT:-3000}:3000"
    environment:
      - NEXT_PUBLIC_API_URL=${API_URL}
      - DATABASE_URL=${DATABASE_URL}
    command: npm run dev
```

#### .NET Core
```yaml
# Template: dotnet
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./src:/app/src
      - ~/.nuget:/root/.nuget  # NuGet cache
    ports:
      - "${PORT:-5000}:5000"
      - "5001:5001"  # HTTPS
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=http://+:5000;https://+:5001
    depends_on:
      - sqlserver

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      ACCEPT_EULA: Y
      SA_PASSWORD: ${DB_PASS:-YourStrong!Passw0rd}
```

#### Python/FastAPI
```yaml
# Template: python-fastapi
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./app:/app/app
      - ./tests:/app/tests
    ports:
      - "${PORT:-8000}:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
    command: uvicorn app.main:app --host 0.0.0.0 --reload
```

#### Monorepo (Frontend + Backend)
```yaml
# Template: monorepo
services:
  frontend:
    build:
      context: ./fe
      dockerfile: Dockerfile.dev
    volumes:
      - ./fe/src:/app/src
      - /app/node_modules
    environment:
      - VITE_API_URL=http://api.${DOMAIN:-localhost}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`${DOMAIN:-localhost}`)"

  backend:
    build:
      context: ./api
      dockerfile: Dockerfile.dev
    volumes:
      - ./api/src:/app/src
    environment:
      - DATABASE_URL=${DATABASE_URL}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`api.${DOMAIN:-localhost}`)"
```

---

## Part 3: Networking Configuration

### Platform-Specific Networking

#### Pure Linux
```yaml
# Simplest setup - Docker networking works natively
networks:
  panopticon:
    driver: bridge

# Access via localhost or container names
# No special configuration needed
```

#### macOS (Docker Desktop)
```yaml
# Docker Desktop on Mac uses a VM
# host.docker.internal available for host access

services:
  app:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

**Notes:**
- File system performance can be slow with bind mounts
- Use `:cached` or `:delegated` volume flags
- Consider using Docker volumes for node_modules

#### Windows (Docker Desktop, no WSL)
```yaml
# Similar to macOS - runs in VM
services:
  app:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

**Notes:**
- File paths use Windows format in docker-compose
- Volume mounts: `C:\Users\dev\project:/app`
- Performance issues with bind mounts
- Consider WSL2 backend for better performance

#### Windows + WSL2 (Recommended for Windows)
```yaml
# Best Windows experience - Docker runs natively in WSL2
# Files should live in WSL filesystem for performance

services:
  app:
    volumes:
      # Good: WSL filesystem
      - /home/user/project:/app
      # Bad: Windows filesystem (slow)
      # - /mnt/c/Users/dev/project:/app
```

**Special Considerations:**
- Store projects in WSL filesystem (`/home/user/`) not Windows (`/mnt/c/`)
- WSL2 has its own IP address, changes on restart
- Use `localhost` from Windows to access WSL2 services (port forwarding automatic)
- For container-to-host communication, use host IP or `host.docker.internal`

**Network Detection Script:**
```bash
# Detect WSL2 host IP for container-to-host communication
WSL_HOST_IP=$(ip route show | grep -i default | awk '{ print $3}')
export DOCKER_HOST_IP=$WSL_HOST_IP
```

---

## Part 4: Traefik & Local Domain Management

### Local Domain Setup: `panopticon.dev`

**Goal:** Access Panopticon dashboard at `https://panopticon.dev` locally with valid SSL.

#### Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        Local Machine                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Browser                                                        │
│      │                                                           │
│      │ https://panopticon.dev                                    │
│      │ https://api.panopticon.dev                                │
│      │ https://min-645.panopticon.dev (workspace)                │
│      ▼                                                           │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                      TRAEFIK                             │   │
│   │  - TLS termination (mkcert certificates)                 │   │
│   │  - Route by hostname                                     │   │
│   │  - Load balancing                                        │   │
│   └─────────────────────────────────────────────────────────┘   │
│      │              │                │                           │
│      ▼              ▼                ▼                           │
│   Dashboard      API Server      Workspace Containers            │
│   (port 3001)    (port 3002)     (dynamic ports)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Traefik Configuration

**docker-compose.traefik.yml:**
```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v3.0
    container_name: panopticon-traefik
    restart: unless-stopped
    command:
      - "--api.dashboard=true"
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.file.directory=/etc/traefik/dynamic"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/certs:/etc/traefik/certs:ro
      - ./traefik/dynamic:/etc/traefik/dynamic:ro
    networks:
      - panopticon

  dashboard:
    image: panopticon-dashboard:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`panopticon.dev`)"
      - "traefik.http.routers.dashboard.entrypoints=websecure"
      - "traefik.http.routers.dashboard.tls=true"
      - "traefik.http.services.dashboard.loadbalancer.server.port=3001"
    networks:
      - panopticon

  api:
    image: panopticon-api:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.panopticon.dev`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls=true"
      - "traefik.http.services.api.loadbalancer.server.port=3002"
    networks:
      - panopticon

networks:
  panopticon:
    name: panopticon
    driver: bridge
```

#### SSL Certificates with mkcert

**Setup script (pan:setup will run this):**
```bash
#!/bin/bash
# install-local-ssl.sh

# Install mkcert if not present
if ! command -v mkcert &> /dev/null; then
    echo "Installing mkcert..."
    
    # Linux
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt install -y libnss3-tools
        curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
        chmod +x mkcert-v*-linux-amd64
        sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
    
    # macOS
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install mkcert
        brew install nss  # for Firefox
    
    # Windows (run in PowerShell)
    # choco install mkcert
    fi
fi

# Install local CA
mkcert -install

# Generate certificates for panopticon.dev and subdomains
mkdir -p ~/.panopticon/traefik/certs
cd ~/.panopticon/traefik/certs

mkcert \
    "panopticon.dev" \
    "*.panopticon.dev" \
    "localhost" \
    "127.0.0.1" \
    "::1"

# Rename to expected names
mv panopticon.dev+4.pem cert.pem
mv panopticon.dev+4-key.pem key.pem

echo "SSL certificates generated!"
```

#### /etc/hosts Configuration

**Linux/macOS:**
```bash
# Add to /etc/hosts (pan:setup will offer to do this)
127.0.0.1   panopticon.dev
127.0.0.1   api.panopticon.dev
127.0.0.1   traefik.panopticon.dev

# Dynamic workspace entries (added/removed by pan:issue)
127.0.0.1   min-645.panopticon.dev
127.0.0.1   min-650.panopticon.dev
```

**Windows:**
```powershell
# Add to C:\Windows\System32\drivers\etc\hosts
127.0.0.1   panopticon.dev
127.0.0.1   api.panopticon.dev
```

**WSL2 Special Case:**
```bash
# WSL2 needs entries in BOTH Linux AND Windows hosts files
# The pan:setup skill will detect WSL2 and configure both

# Also need to handle WSL2's dynamic IP
# Option 1: Use localhost (works due to port forwarding)
# Option 2: Use host.docker.internal in containers
```

#### Dynamic Workspace Routing

When `pan:issue MIN-645` creates a workspace:

1. Add `/etc/hosts` entry: `127.0.0.1 min-645.panopticon.dev`
2. Workspace containers get Traefik labels automatically
3. Access workspace at `https://min-645.panopticon.dev`

```yaml
# Workspace docker-compose adds these labels
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.min-645-fe.rule=Host(`min-645.panopticon.dev`)"
      - "traefik.http.routers.min-645-fe.tls=true"
  
  backend:
    labels:
      - "traefik.enable=true"  
      - "traefik.http.routers.min-645-api.rule=Host(`api.min-645.panopticon.dev`)"
      - "traefik.http.routers.min-645-api.tls=true"
```

---

## Part 5: Skill Implementation Details

### Skill File Structure

```
~/.panopticon/skills/
├── pan-help/
│   └── SKILL.md
├── pan-install/
│   ├── SKILL.md
│   └── templates/
│       └── install-checklist.md
├── pan-setup/
│   ├── SKILL.md
│   └── templates/
│       ├── config-template.toml
│       └── hosts-template.txt
├── pan-docker/
│   ├── SKILL.md
│   └── templates/
│       ├── spring-boot/
│       ├── react-vite/
│       ├── nextjs/
│       ├── dotnet/
│       └── monorepo/
├── pan-network/
│   ├── SKILL.md
│   └── templates/
│       ├── traefik/
│       └── hosts/
└── ...
```

### Skill Interactions

Skills should be composable and reference each other:

```markdown
# In pan:quickstart SKILL.md

## Workflow

1. Run `pan:install` steps
2. Run `pan:setup` steps  
3. Run `pan:docker` to configure app type
4. Run `pan:network` to set up Traefik
5. Run `pan:up` to start everything
6. Run `pan:issue` to create first workspace
```

---

## Part 6: Implementation Plan

### Phase 1: Core Skills (P0)
- [ ] `pan:help` - Entry point
- [ ] `pan:install` - Installation guide
- [ ] `pan:setup` - Configuration wizard
- [ ] `pan:quickstart` - Combined onboarding
- [ ] `pan:up` / `pan:down` - Service management
- [ ] `pan:status` - Health overview
- [ ] `pan:plan` - Planning workflow (already built)
- [ ] `pan:issue` - Workspace + agent creation

### Phase 2: Configuration & Docker (P1)
- [ ] `pan:config` - Configuration management
- [ ] `pan:tracker` - Issue tracker setup
- [ ] `pan:states` - State mapping configuration
- [ ] `pan:docker` - Docker template management
- [ ] `pan:network` - Networking & Traefik setup
- [ ] `pan:sync` - Claude Code sync

### Phase 3: Operations & Troubleshooting (P1-P2)
- [ ] `pan:approve` - Work approval flow
- [ ] `pan:tell` / `pan:kill` - Agent management
- [ ] `pan:health` - Health checks
- [ ] `pan:diagnose` - Troubleshooting guide
- [ ] `pan:logs` - Log viewing
- [ ] `pan:rescue` - Recovery operations

### Phase 4: Extension (P2)
- [ ] `pan:skill-create` - Skill authoring guide

---

## Acceptance Criteria

- [ ] All P0 skills implemented and tested
- [ ] Docker templates for all listed app types
- [ ] Networking works on all platforms (Linux, macOS, Windows, WSL2)
- [ ] Traefik configured with valid local SSL
- [ ] `https://panopticon.dev` accessible locally
- [ ] Dynamic workspace domains working (`https://min-xxx.panopticon.dev`)
- [ ] Skills documented with examples
- [ ] Integration tests for setup flows

---

## References

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [mkcert - Local SSL](https://github.com/FiloSottile/mkcert)
- [Docker Networking](https://docs.docker.com/network/)
- [WSL2 Networking](https://learn.microsoft.com/en-us/windows/wsl/networking)
- [Claude Code Skills](https://docs.anthropic.com/claude-code/skills)

---

## Your Mission

You are a planning agent conducting a **discovery session** for this issue.

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

### Phase 3: Generate Artifacts (NO CODE!)
When discovery is complete:
1. Create STATE.md with decisions made
2. Create beads tasks with dependencies using `bd create`
3. Summarize the plan and STOP

**Remember:** Be a thinking partner, not an interviewer. Ask questions that help clarify.

Start by exploring the codebase to understand the context, then begin the discovery conversation.
