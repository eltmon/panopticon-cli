# Next.js Full-Stack Template

This template provides a development environment for Next.js applications with PostgreSQL.

## Services

- **App**: Next.js with App Router (hot reload enabled)
- **PostgreSQL**: Database (isolated or shared)

## Quick Start

```bash
# Start development environment
./dev

# Or with docker compose directly
docker compose up --build
```

## URLs

- App: `https://{workspace}.{domain}`

## Prisma Setup

If Prisma is enabled, run the initialization script after first start:

```bash
docker compose exec app ./scripts/prisma-init.sh
```

## Hot Reload

Changes to your Next.js code are automatically reloaded via Fast Refresh.
