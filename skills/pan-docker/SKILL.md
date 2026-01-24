---
name: pan-docker
description: Docker template selection and configuration for workspaces
triggers:
  - pan docker
  - docker setup
  - containerize workspace
  - docker template
  - setup docker for project
allowed-tools:
  - Bash
  - Read
  - Write
---

# Docker Template Configuration

## Overview

This skill guides you through selecting and configuring Docker templates for Panopticon workspaces. Templates provide containerized development environments with hot reload, databases, and Traefik integration.

## When to Use

- Setting up Docker for a new project
- Choosing the right template for your stack
- Configuring container settings
- Integrating with Traefik for local HTTPS

## Quick Start

```bash
# List available templates
pan workspace templates

# Create workspace with template
pan workspace create PAN-123 --template spring-boot-react

# Auto-detect template from project files
pan workspace create PAN-123 --docker

# Disable Traefik routing
pan workspace create PAN-123 --template nextjs-fullstack --no-traefik

# Use shared database
pan workspace create PAN-123 --template monorepo --shared-db
```

## Available Templates

| Template | Stack | Services |
|----------|-------|----------|
| `spring-boot-react` | Java 21 + React/Vite | frontend, api, database, redis |
| `nextjs-fullstack` | Next.js 14+ + PostgreSQL | frontend, database |
| `python-fastapi` | Python 3.12 + FastAPI | api, database, frontend (optional), redis |
| `monorepo` | Node.js Frontend + Backend | frontend, api, database, redis |

## Template Selection Guide

### By Language/Framework

| Your Stack | Recommended Template |
|------------|---------------------|
| Java/Spring | `spring-boot` |
| React (CRA, Vite) | `react-vite` |
| Next.js | `nextjs` |
| .NET Core/ASP.NET | `dotnet` |
| Python/FastAPI | `python-fastapi` |
| Full-stack | `monorepo` |

### By Database Needs

| Need | Templates |
|------|-----------|
| PostgreSQL | `spring-boot`, `python-fastapi`, `monorepo` |
| SQL Server | `dotnet` |
| Redis | `spring-boot`, `python-fastapi`, `monorepo` |
| No database | `react-vite`, `nextjs` |

## Workflow: Add Docker to Project

### 1. Copy Template Files

```bash
# Choose your template
TEMPLATE=react-vite  # or: spring-boot, nextjs, dotnet, python-fastapi, monorepo

# Copy to project
cp /home/eltmon/projects/panopticon/templates/docker/$TEMPLATE/* /path/to/your/project/
```

### 2. Create Environment File

```bash
cd /path/to/your/project

cat > .env << 'EOF'
# Application
APP_PORT=3000
HOSTNAME=myapp.pan.localhost
COMPOSE_PROJECT_NAME=myapp

# Database (if applicable)
DB_NAME=myappdb
DB_USER=postgres
DB_PASSWORD=secretpassword
EOF
```

### 3. Start Containers

```bash
docker compose up -d
```

### 4. Verify

```bash
docker compose ps
docker compose logs -f app
```

## Template Details

### spring-boot

**Files:**
- `Dockerfile.dev` - Java 21 + Maven
- `docker-compose.yml` - App + PostgreSQL + Redis

**Ports:**
- 8080: Application
- 5005: Debug
- 5432: PostgreSQL
- 6379: Redis

**Hot reload:** spring-boot-devtools

### react-vite

**Files:**
- `Dockerfile.dev` - Node.js 20
- `docker-compose.yml` - App only

**Ports:**
- 5173: Vite dev server

**Hot reload:** Vite HMR with polling

### nextjs

**Files:**
- `Dockerfile.dev` - Node.js 20
- `docker-compose.yml` - App only

**Ports:**
- 3000: Next.js dev server

**Hot reload:** Fast Refresh with WATCHPACK_POLLING

### dotnet

**Files:**
- `Dockerfile.dev` - .NET 8 SDK
- `docker-compose.yml` - App + SQL Server

**Ports:**
- 5000: Application
- 1433: SQL Server

**Hot reload:** dotnet watch

### python-fastapi

**Files:**
- `Dockerfile.dev` - Python 3.12
- `docker-compose.yml` - App + PostgreSQL + Redis

**Ports:**
- 8000: FastAPI
- 5432: PostgreSQL
- 6379: Redis

**Hot reload:** Uvicorn --reload

### monorepo

**Files:**
- `Dockerfile.frontend` - React/Vite
- `Dockerfile.backend` - Node.js
- `docker-compose.yml` - Both + PostgreSQL + Redis

**Ports:**
- 5173: Frontend
- 3001: Backend API
- 5432: PostgreSQL
- 6379: Redis

## Customization

### Add a Service

Edit `docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"
    networks:
      - app-network
```

### Change Ports

Edit `.env`:

```bash
APP_PORT=8080
DB_PORT=5433
```

### Add Environment Variables

Edit `docker-compose.yml` under the service:

```yaml
environment:
  - MY_VAR=value
  - ANOTHER_VAR=${FROM_ENV_FILE}
```

## Traefik Integration

All templates include Traefik labels for local HTTPS:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.myapp.rule=Host(`myapp.pan.localhost`)"
```

### Enable Traefik

1. Start Traefik (if not running):
   ```bash
   cd /path/to/panopticon/templates/traefik
   docker compose up -d
   ```

2. Connect your app to Traefik network:
   ```yaml
   networks:
     traefik:
       external: true
       name: traefik_default
   ```

3. Access via: https://myapp.pan.localhost

## Troubleshooting

**Container won't start:**
```bash
docker compose logs app
# Check for errors, missing dependencies
```

**Hot reload not working:**
- Verify polling is enabled (check Dockerfile/compose)
- Check volume mounts are correct
- Restart: `docker compose restart app`

**Port conflicts:**
```bash
# Find what's using the port
lsof -i :3000
# Change port in .env
```

**Database connection failed:**
```bash
# Wait for healthcheck
docker compose ps
# Check credentials match
```

## Related Skills

- `/pan:network` - Traefik and networking setup
- `/pan:projects` - Project management
- `/pan:config` - Configuration
