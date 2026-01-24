# PAN-96: Template-based workspace creation with Docker orchestration

## Summary

Implement a comprehensive template-based workspace creation system that handles complex multi-container projects. This replaces the current simple git worktree approach with a full Docker orchestration system including Traefik routing, port management, and customizable templates.

See [PRD.md](./PRD.md) for complete requirements.

## Architecture Decisions

1. **Template Engine**: Use Jinja2-style templating (via nunjucks for Node.js) for docker-compose and script generation
2. **Configuration Location**: Templates in `~/.panopticon/templates/` with built-ins in package
3. **Port Strategy**: Support offset, dynamic, and static port allocation
4. **Database Isolation**: Configurable shared vs per-workspace databases
5. **Template Format**: YAML manifest + template files with `.j2` extension

## Implementation Phases

### Phase 1: Core Template Engine
- Create `TemplateEngine` class in `src/lib/template-engine.ts`
- Define `TemplateManifest` interface
- Implement variable substitution with workspace-specific values
- Support conditional sections (include/exclude services)

### Phase 2: Built-in Templates
- Create `spring-boot-react` template (based on MYN's working setup)
- Create `nextjs` template
- Create `python-fastapi` template
- Create `monorepo` template for multi-service Node.js projects

### Phase 3: Workspace Creation Flow
- Update `pan workspace create` to detect and use templates
- Auto-detect project type if template not specified
- Generate docker-compose, dev script, .env from templates
- Set up Traefik routing automatically
- Handle polyrepo worktree creation

### Phase 4: Port and Resource Management
- Implement port allocation strategies (offset, dynamic, static)
- Track allocated ports in `~/.panopticon/state/ports.json`
- Implement database sharing vs isolation
- Set up shared cache volumes

### Phase 5: `/pan-docker` Skill
- Create interactive setup skill
- Detect project type and recommend template
- Walk through configuration options
- Test container startup
- Save configuration to `projects.yaml`

### Phase 6: Documentation
- Update README with full documentation
- Create template authoring guide
- Document configuration options
- Add troubleshooting section

## Files to Create

### Core
- `src/lib/template-engine.ts` - Template processing engine
- `src/lib/template-engine.test.ts` - Unit tests
- `src/lib/port-manager.ts` - Port allocation tracking
- `src/lib/port-manager.test.ts` - Unit tests

### Templates
- `templates/spring-boot-react/manifest.yaml`
- `templates/spring-boot-react/docker-compose.yml.j2`
- `templates/spring-boot-react/Dockerfile.api`
- `templates/spring-boot-react/Dockerfile.fe`
- `templates/spring-boot-react/dev.sh.j2`
- `templates/spring-boot-react/.env.j2`
- `templates/nextjs/manifest.yaml`
- `templates/nextjs/docker-compose.yml.j2`
- `templates/nextjs/Dockerfile`
- `templates/nextjs/dev.sh.j2`
- `templates/python-fastapi/manifest.yaml`
- `templates/python-fastapi/docker-compose.yml.j2`
- `templates/python-fastapi/Dockerfile`
- `templates/python-fastapi/dev.sh.j2`

### Skills
- `skills/pan-docker/SKILL.md` - Interactive setup skill

## Files to Modify

- `src/cli/commands/workspace.ts` - Use template engine
- `src/lib/projects.ts` - Add workspace config types
- `src/lib/template.ts` - Integrate with template engine
- `README.md` - Add comprehensive documentation

## Dependencies to Add

```json
{
  "nunjucks": "^3.2.4",
  "@types/nunjucks": "^3.2.6"
}
```

## Testing Strategy

### Unit Tests
- Template engine variable substitution
- Conditional sections
- Port allocation algorithms
- Manifest parsing

### Integration Tests
- Template generation produces valid docker-compose
- Generated dev script works correctly
- Port conflicts detected and handled

### E2E Tests
- `pan workspace create` with different templates
- Containers start successfully
- Traefik routing works

## Success Criteria

- [ ] `pan workspace create` auto-detects project type
- [ ] Spring Boot + React projects work out of the box
- [ ] Next.js projects work out of the box
- [ ] Python + FastAPI projects work out of the box
- [ ] Custom templates can be created and used
- [ ] Port conflicts are handled gracefully
- [ ] Database can be shared or isolated per config
- [ ] `/pan-docker` skill guides new users through setup
- [ ] Documentation is comprehensive
- [ ] All tests pass
