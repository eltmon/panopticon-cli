# Spring Boot + React Template

This template provides a development environment for Spring Boot backend with React/Vite frontend.

## Services

- **Frontend**: React with Vite (hot reload enabled)
- **API**: Spring Boot with Maven (remote debugging available)
- **PostgreSQL**: Database (isolated or shared)
- **Redis**: Cache (optional)

## Quick Start

```bash
# Start development environment
./dev

# Or with docker compose directly
docker compose up --build
```

## URLs

- Frontend: `https://{workspace}.{domain}`
- API: `https://api-{workspace}.{domain}`

## Configuration

Edit `.env` to customize ports and settings.

## Hot Reload

- Frontend: Changes to React code are automatically reloaded
- Backend: Maven spring-boot:run with devtools enables code reloading

## Debugging

Remote debugging is available on port `API_PORT + 1000`. Configure your IDE to connect to `localhost:{debug_port}`.
