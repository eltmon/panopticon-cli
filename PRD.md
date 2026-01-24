## Overview

Panopticon needs a first-class, template-based workspace creation system that handles complex multi-container projects. This is a **core offering** of Panopticon - the ability to spin up isolated development environments with proper Docker orchestration, Traefik routing, and customizable configuration.

Currently, projects like MYN use a custom `workspace_command` script (workaround implemented in commit 6e5ccc0), but this logic should be built into Panopticon with a flexible template system.

## Goals

1. **Zero-config for common stacks** - Spring Boot + React, Next.js, Python + FastAPI should "just work"
2. **Fully customizable** - Projects can provide their own templates or extend defaults
3. **Isolation by default** - Each workspace gets its own containers, databases, ports
4. **Shared resources optional** - Caches, databases can be shared when appropriate
5. **Traefik integration** - Automatic routing to workspace-specific URLs
6. **Developer experience** - Simple `./dev` script in each workspace for container management

## User Stories

### As a developer with a simple monorepo
I want to run `pan workspace create MIN-123` and have it:
- Create git worktree
- Generate docker-compose with my stack (auto-detected or configured)
- Set up Traefik routing for `feature-min-123.app.localhost` and `api-feature-min-123.app.localhost`
- Create a `./dev` script for `up`, `down`, `logs`, `status` commands

### As a developer with a polyrepo (separate frontend/backend repos)
I want to configure Panopticon to:
- Create worktrees in both repos
- Generate a unified docker-compose that references both
- Handle the complexity of multiple git roots

### As a developer with complex infrastructure (PAN-52)
I want to configure:
- Which services to spin up (db, cache, app server, dev server)
- Whether to share database across workspaces or isolate
- Port allocation strategy (dynamic, offset-based, or configured)
- Volume caching strategy (shared maven/gradle/npm caches)
- Custom Dockerfiles or base images
- Environment variable injection from `.env` files

### As a first-time Panopticon user
I want a `/pan-docker` skill that guides me through:
- Detecting my project type
- Choosing a template
- Customizing settings
- Testing the setup
- Saving configuration to `projects.yaml`

## Architecture

### Configuration in `projects.yaml`

```yaml
projects:
  myn:
    name: "Mind Your Now"
    path: /home/user/projects/myn
    linear_team: MIN
    
    # Workspace creation settings
    workspace:
      # Template to use (built-in or custom path)
      template: spring-boot-react
      # OR: template: /path/to/my/templates/
      
      # For polyrepo projects - list of repos to create worktrees for
      repos:
        - path: api        # relative to project root
          branch_prefix: feature/
        - path: frontend
          branch_prefix: feature/
      
      # Docker settings
      docker:
        # How to handle ports (dynamic, offset, or static)
        port_strategy: offset  # offset adds workspace number to base ports
        base_ports:
          frontend: 5173
          backend: 8080
          database: 5432
        
        # Database isolation
        database:
          strategy: isolated  # or 'shared'
          image: postgres:16-alpine
          # For shared: use a single database container
          # For isolated: each workspace gets its own
        
        # Cache sharing
        caches:
          maven: shared      # ~/.m2 mounted to all workspaces
          npm: shared        # shared pnpm store
          gradle: shared     # ~/.gradle mounted
        
        # Traefik integration
        traefik:
          enabled: true
          domain: myn.test   # workspace gets feature-xxx.myn.test
          network: traefik-public
        
        # Additional services
        services:
          redis:
            enabled: true
            isolation: per-workspace
          elasticsearch:
            enabled: false

  enterprise-app:
    name: "Enterprise Java App"
    path: /home/user/projects/enterprise
    linear_team: ENT
    
    workspace:
      template: custom
      template_path: .panopticon/templates/
      
      docker:
        # SQL Server instead of Postgres
        database:
          strategy: shared  # Share DB to avoid 15-min migrations
          image: mcr.microsoft.com/mssql/server:2017-latest
          port: 1433
          env:
            ACCEPT_EULA: "Y"
            SA_PASSWORD: "${DB_PASSWORD}"
        
        # Tomcat app server
        services:
          tomcat:
            enabled: true
            image: tomcat:9.0-jdk11-corretto
            ports: [8080, 8060]
            volumes:
              - ./build/exploded:/usr/local/tomcat/webapps/app
            depends_on: [database]
        
        # Port conflict resolution
        port_strategy: dynamic  # Docker assigns random available ports
```

### Template Directory Structure

Templates live in `~/.panopticon/templates/` or bundled in Panopticon:

```
templates/
├── spring-boot-react/
│   ├── manifest.yaml          # Template metadata and options
│   ├── docker-compose.yml.j2  # Jinja2 template
│   ├── Dockerfile.api         # API Dockerfile
│   ├── Dockerfile.fe          # Frontend Dockerfile  
│   ├── dev.sh.j2              # Dev script template
│   ├── .env.j2                # Environment template
│   └── README.md              # Template documentation
│
├── nextjs/
│   └── ...
│
├── python-fastapi/
│   └── ...
│
├── spring-boot-mssql/         # For enterprise Java (PAN-52)
│   ├── manifest.yaml
│   ├── docker-compose.yml.j2
│   ├── Dockerfile.devcontainer
│   └── ...
│
└── custom/                    # User's custom templates
    └── ...
```

### Template Manifest (`manifest.yaml`)

```yaml
name: spring-boot-react
description: Spring Boot API with React frontend
version: 1.0.0

# What this template provides
services:
  - api
  - frontend
  - postgres
  - redis

# Template variables with defaults
variables:
  java_version:
    type: string
    default: "21"
    description: Java version for API
  node_version:
    type: string
    default: "20"
    description: Node.js version for frontend
  postgres_version:
    type: string
    default: "16"
  use_redis:
    type: boolean
    default: true
  api_port:
    type: integer
    default: 8080
  frontend_port:
    type: integer
    default: 5173

# Files to generate
outputs:
  - docker-compose.yml.j2 -> .devcontainer/docker-compose.yml
  - Dockerfile.api -> .devcontainer/Dockerfile.api
  - Dockerfile.fe -> .devcontainer/Dockerfile.fe
  - dev.sh.j2 -> dev
  - .env.j2 -> .env
```

### The `./dev` Script

Every workspace gets a generated `./dev` script:

```bash
./dev up              # Start all containers
./dev down            # Stop containers
./dev down --volumes  # Stop and remove volumes
./dev api             # Start just API (foreground)
./dev fe              # Start just frontend (foreground)
./dev logs [service]  # Tail logs
./dev status          # Show container status and URLs
./dev shell [service] # Open shell in container
./dev wait-ready      # Block until all services healthy
./dev warmup          # Pre-warm caches (hit endpoints)
```

## Implementation Plan

### Phase 1: Core Template Engine
- [ ] Create `TemplateEngine` class that processes Jinja2 templates
- [ ] Define `TemplateManifest` interface
- [ ] Implement variable substitution with workspace-specific values
- [ ] Support conditional sections (e.g., include redis only if enabled)

### Phase 2: Built-in Templates
- [ ] Create `spring-boot-react` template (based on MYN's working setup)
- [ ] Create `nextjs` template
- [ ] Create `python-fastapi` template
- [ ] Create `spring-boot-mssql` template (for PAN-52 requirements)
- [ ] Create `monorepo` template for multi-service Node.js projects

### Phase 3: Workspace Creation Flow
- [ ] Update `pan workspace create` to use templates
- [ ] Auto-detect project type if template not specified
- [ ] Generate docker-compose, dev script, .env from templates
- [ ] Set up Traefik routing automatically
- [ ] Handle polyrepo worktree creation

### Phase 4: Port and Resource Management
- [ ] Implement port allocation strategies (offset, dynamic, static)
- [ ] Track allocated ports in `~/.panopticon/state/ports.json`
- [ ] Implement database sharing vs isolation
- [ ] Set up shared cache volumes

### Phase 5: `/pan-docker` Skill
- [ ] Create interactive setup skill
- [ ] Detect project type and recommend template
- [ ] Walk through configuration options
- [ ] Test container startup
- [ ] Save configuration to `projects.yaml`
- [ ] Generate custom template if needed

### Phase 6: Documentation
- [ ] Update README with full documentation
- [ ] Create template authoring guide
- [ ] Document configuration options
- [ ] Add troubleshooting section (including MAVEN_CONFIG pitfall)
- [ ] Create video walkthrough

## Technical Considerations

### Git Worktree Path Handling (PAN-52 Q1)
Templates use `{{WORKSPACE_PATH}}` variable. Docker volumes mount relative to workspace root, not project root.

### Multi-Container Orchestration (PAN-52 Q2)
Full docker-compose support with health checks, depends_on, and network isolation.

### Shared Database State (PAN-52 Q3)
Configurable via `database.strategy: shared|isolated`. Shared uses a single container with unique database per workspace. Isolated spins up separate containers.

### Build Artifacts (PAN-52 Q4)
Each workspace has its own build output. Templates configure volume mounts appropriately.

### Port Conflicts (PAN-52 Q5)
Three strategies:
- **offset**: Base port + workspace number (e.g., 5173, 5174, 5175...)
- **dynamic**: Let Docker assign random available ports
- **static**: User configures explicit ports (conflicts if multiple workspaces)

### Volume Caches (PAN-52 Q6)
Configurable per cache type. Maven/Gradle/npm caches typically shared. Database volumes typically isolated.

## Environment Variable Pitfalls to Document

### MAVEN_CONFIG
**DO NOT** set `MAVEN_CONFIG=/some/path` - Maven interprets this as CLI arguments, not a directory. Use `-Dmaven.repo.local=/path` in the command instead.

### PNPM_HOME
Set `PNPM_HOME=/pnpm-store` and mount a named volume for the store.

### Non-root User Containers
When running containers as host user (`user: "${UID}:${GID}"`), ensure cache directories are writable.

## Success Criteria

1. New users can run `/pan-docker` and have a working containerized dev environment in < 5 minutes
2. Projects with custom needs can create their own templates
3. PAN-52's enterprise Java project can be configured without custom scripts
4. MYN's current setup can be migrated from custom `workspace_command` to built-in template
5. Documentation is comprehensive and includes troubleshooting

## Related

- PAN-52: Complex multi-container project guidance (this addresses those questions)
- MYN's `new-feature` script: Reference implementation to learn from
- Commit 6e5ccc0: `workspace_command` workaround (interim solution)

## Priority

**HIGH** - This is a core differentiator for Panopticon. The ability to spin up isolated, containerized development environments is essential for multi-agent workflows.
