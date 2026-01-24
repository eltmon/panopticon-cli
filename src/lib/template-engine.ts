/**
 * Template Engine for workspace generation
 *
 * Uses nunjucks to process Jinja2-style templates for generating
 * docker-compose files, dev scripts, and other workspace configuration.
 */

import nunjucks from 'nunjucks';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import * as yaml from 'yaml';

/**
 * Template manifest defining what a template provides and its configuration options
 */
export interface TemplateManifest {
  /** Template name (e.g., 'spring-boot-react') */
  name: string;

  /** Human-readable description */
  description: string;

  /** Template version */
  version: string;

  /** Services this template provides */
  services: string[];

  /** Configuration variables with defaults */
  variables: Record<string, TemplateVariable>;

  /** Output file mappings (template -> destination) */
  outputs: TemplateOutput[];

  /** Optional: Files to copy without processing */
  copy?: string[];

  /** Optional: Post-generation hooks */
  hooks?: TemplateHooks;
}

export interface TemplateVariable {
  type: 'string' | 'number' | 'boolean' | 'array';
  default: string | number | boolean | string[];
  description: string;
  /** Optional: Allowed values for enum-like variables */
  enum?: (string | number | boolean)[];
  /** Optional: Whether this variable is required */
  required?: boolean;
}

export interface TemplateOutput {
  /** Source template file (relative to template dir) */
  source: string;
  /** Destination path (relative to workspace) */
  destination: string;
  /** Optional: Make executable after generation */
  executable?: boolean;
  /** Optional: Condition for including this output */
  condition?: string;
}

export interface TemplateHooks {
  /** Command to run after all files generated */
  postGenerate?: string;
  /** Command to validate the generated workspace */
  validate?: string;
}

/**
 * Context passed to templates during rendering
 */
export interface TemplateContext {
  /** Workspace-specific variables */
  workspace: {
    /** Workspace name (e.g., 'feature-pan-96') */
    name: string;
    /** Full path to workspace */
    path: string;
    /** Issue ID (e.g., 'PAN-96') */
    issueId: string;
    /** Branch name (e.g., 'feature/pan-96') */
    branch: string;
  };

  /** Project-level variables */
  project: {
    /** Project name */
    name: string;
    /** Project root path */
    path: string;
  };

  /** Docker/container configuration */
  docker: {
    /** Port strategy: 'offset' | 'dynamic' | 'static' */
    portStrategy: 'offset' | 'dynamic' | 'static';
    /** Base ports for services */
    basePorts: Record<string, number>;
    /** Workspace offset for port calculation */
    portOffset: number;
    /** Traefik configuration */
    traefik: {
      enabled: boolean;
      domain: string;
      network: string;
    };
    /** Database configuration */
    database: {
      strategy: 'isolated' | 'shared';
      image: string;
      port: number;
    };
    /** Cache sharing configuration */
    caches: Record<string, 'shared' | 'isolated'>;
  };

  /** User-provided variable overrides */
  variables: Record<string, unknown>;

  /** Computed values available to templates */
  computed: Record<string, unknown>;
}

/**
 * Result of template generation
 */
export interface GenerationResult {
  success: boolean;
  filesGenerated: string[];
  filesCopied: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Template Engine for processing workspace templates
 */
export class TemplateEngine {
  private env: nunjucks.Environment;
  private templateDirs: string[];

  constructor(templateDirs: string[] = []) {
    // Default template directories
    this.templateDirs = [
      ...templateDirs,
      join(process.env.HOME || '', '.panopticon', 'templates'),
      join(__dirname, '..', '..', 'templates'),
    ].filter(existsSync);

    // Configure nunjucks
    this.env = nunjucks.configure(this.templateDirs, {
      autoescape: false, // Don't escape - we're generating config files, not HTML
      trimBlocks: true,
      lstripBlocks: true,
      throwOnUndefined: false, // Allow undefined variables (handled by defaults)
    });

    // Add custom filters
    this.registerFilters();
  }

  /**
   * Register custom nunjucks filters
   */
  private registerFilters(): void {
    // Port calculation filter
    this.env.addFilter('port', (basePort: number, offset: number) => {
      return basePort + offset;
    });

    // Slugify filter (for DNS-safe names)
    this.env.addFilter('slugify', (str: string) => {
      return str.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    });

    // YAML dump filter
    this.env.addFilter('yaml', (obj: unknown) => {
      return yaml.stringify(obj);
    });

    // JSON filter
    this.env.addFilter('tojson', (obj: unknown, indent?: number) => {
      return JSON.stringify(obj, null, indent);
    });

    // Default filter with type coercion
    this.env.addFilter('default_value', (value: unknown, defaultValue: unknown) => {
      return value !== undefined && value !== null ? value : defaultValue;
    });

    // Boolean to string (for docker-compose env vars)
    this.env.addFilter('bool_env', (value: boolean) => {
      return value ? 'true' : 'false';
    });
  }

  /**
   * Find a template by name
   */
  findTemplate(name: string): string | null {
    for (const dir of this.templateDirs) {
      const templatePath = join(dir, name);
      if (existsSync(templatePath) && existsSync(join(templatePath, 'manifest.yaml'))) {
        return templatePath;
      }
    }
    return null;
  }

  /**
   * List available templates
   */
  listTemplates(): { name: string; path: string; manifest: TemplateManifest }[] {
    const templates: { name: string; path: string; manifest: TemplateManifest }[] = [];

    for (const dir of this.templateDirs) {
      if (!existsSync(dir)) continue;

      for (const entry of readdirSync(dir)) {
        const entryPath = join(dir, entry);
        const manifestPath = join(entryPath, 'manifest.yaml');

        if (statSync(entryPath).isDirectory() && existsSync(manifestPath)) {
          try {
            const manifest = this.loadManifest(manifestPath);
            templates.push({ name: entry, path: entryPath, manifest });
          } catch {
            // Skip invalid manifests
          }
        }
      }
    }

    return templates;
  }

  /**
   * Load and parse a template manifest
   */
  loadManifest(manifestPath: string): TemplateManifest {
    const content = readFileSync(manifestPath, 'utf-8');
    const manifest = yaml.parse(content) as TemplateManifest;

    // Validate required fields
    if (!manifest.name) throw new Error('Manifest missing required field: name');
    if (!manifest.version) throw new Error('Manifest missing required field: version');
    if (!manifest.outputs || !Array.isArray(manifest.outputs)) {
      throw new Error('Manifest missing required field: outputs (array)');
    }

    // Set defaults
    manifest.services = manifest.services || [];
    manifest.variables = manifest.variables || {};
    manifest.copy = manifest.copy || [];

    return manifest;
  }

  /**
   * Build the complete context for template rendering
   */
  buildContext(
    manifest: TemplateManifest,
    workspaceConfig: Partial<TemplateContext['workspace']>,
    projectConfig: Partial<TemplateContext['project']>,
    dockerConfig: Partial<TemplateContext['docker']>,
    userVariables: Record<string, unknown> = {}
  ): TemplateContext {
    // Merge user variables with manifest defaults
    const variables: Record<string, unknown> = {};
    for (const [key, config] of Object.entries(manifest.variables)) {
      variables[key] = userVariables[key] !== undefined ? userVariables[key] : config.default;
    }

    // Build computed values
    const computed: Record<string, unknown> = {};

    // Compute ports based on strategy
    const portOffset = dockerConfig.portOffset || 0;
    computed.ports = {};
    for (const [service, basePort] of Object.entries(dockerConfig.basePorts || {})) {
      if (dockerConfig.portStrategy === 'offset') {
        (computed.ports as Record<string, number>)[service] = basePort + portOffset;
      } else if (dockerConfig.portStrategy === 'static') {
        (computed.ports as Record<string, number>)[service] = basePort;
      }
      // 'dynamic' strategy: ports are assigned by Docker, use env vars
    }

    // Compute URLs
    const domain = dockerConfig.traefik?.domain || 'localhost';
    const workspaceName = workspaceConfig.name || 'workspace';
    computed.urls = {
      frontend: `https://${workspaceName}.${domain}`,
      api: `https://api-${workspaceName}.${domain}`,
    };

    return {
      workspace: {
        name: workspaceConfig.name || 'workspace',
        path: workspaceConfig.path || '',
        issueId: workspaceConfig.issueId || '',
        branch: workspaceConfig.branch || '',
      },
      project: {
        name: projectConfig.name || 'project',
        path: projectConfig.path || '',
      },
      docker: {
        portStrategy: dockerConfig.portStrategy || 'offset',
        basePorts: dockerConfig.basePorts || {},
        portOffset: portOffset,
        traefik: {
          enabled: dockerConfig.traefik?.enabled ?? true,
          domain: domain,
          network: dockerConfig.traefik?.network || 'traefik-public',
        },
        database: {
          strategy: dockerConfig.database?.strategy || 'isolated',
          image: dockerConfig.database?.image || 'postgres:16-alpine',
          port: dockerConfig.database?.port || 5432,
        },
        caches: dockerConfig.caches || {},
      },
      variables,
      computed,
    };
  }

  /**
   * Render a single template file
   */
  renderTemplate(templatePath: string, context: TemplateContext): string {
    const content = readFileSync(templatePath, 'utf-8');
    return this.env.renderString(content, context);
  }

  /**
   * Evaluate a condition expression against context
   */
  evaluateCondition(condition: string, context: TemplateContext): boolean {
    try {
      // Simple condition evaluation using nunjucks
      const result = this.env.renderString(`{% if ${condition} %}true{% else %}false{% endif %}`, context);
      return result.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Generate a workspace from a template
   */
  generate(
    templateName: string,
    workspacePath: string,
    context: Omit<TemplateContext, 'workspace'> & { workspace: Partial<TemplateContext['workspace']> }
  ): GenerationResult {
    const result: GenerationResult = {
      success: true,
      filesGenerated: [],
      filesCopied: [],
      errors: [],
      warnings: [],
    };

    // Find template
    const templatePath = this.findTemplate(templateName);
    if (!templatePath) {
      result.success = false;
      result.errors.push(`Template not found: ${templateName}`);
      return result;
    }

    // Load manifest
    let manifest: TemplateManifest;
    try {
      manifest = this.loadManifest(join(templatePath, 'manifest.yaml'));
    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to load manifest: ${error}`);
      return result;
    }

    // Complete the context
    const fullContext: TemplateContext = {
      ...context,
      workspace: {
        name: context.workspace.name || basename(workspacePath),
        path: workspacePath,
        issueId: context.workspace.issueId || '',
        branch: context.workspace.branch || '',
      },
    };

    // Create workspace directory
    mkdirSync(workspacePath, { recursive: true });

    // Process outputs
    for (const output of manifest.outputs) {
      // Check condition if specified
      if (output.condition && !this.evaluateCondition(output.condition, fullContext)) {
        continue;
      }

      const sourcePath = join(templatePath, output.source);
      const destPath = join(workspacePath, output.destination);

      if (!existsSync(sourcePath)) {
        result.warnings.push(`Template file not found: ${output.source}`);
        continue;
      }

      try {
        // Ensure destination directory exists
        mkdirSync(dirname(destPath), { recursive: true });

        // Check if it's a template file
        if (output.source.endsWith('.j2') || output.source.endsWith('.template')) {
          // Render template
          const rendered = this.renderTemplate(sourcePath, fullContext);
          writeFileSync(destPath, rendered);
        } else {
          // Copy file as-is
          const content = readFileSync(sourcePath);
          writeFileSync(destPath, content);
        }

        // Make executable if needed
        if (output.executable) {
          const { chmodSync } = require('fs');
          chmodSync(destPath, 0o755);
        }

        result.filesGenerated.push(output.destination);
      } catch (error) {
        result.errors.push(`Failed to generate ${output.destination}: ${error}`);
        result.success = false;
      }
    }

    // Copy static files
    for (const copyPath of manifest.copy || []) {
      const sourcePath = join(templatePath, copyPath);
      const destPath = join(workspacePath, copyPath);

      if (!existsSync(sourcePath)) {
        result.warnings.push(`Copy file not found: ${copyPath}`);
        continue;
      }

      try {
        mkdirSync(dirname(destPath), { recursive: true });
        const content = readFileSync(sourcePath);
        writeFileSync(destPath, content);
        result.filesCopied.push(copyPath);
      } catch (error) {
        result.errors.push(`Failed to copy ${copyPath}: ${error}`);
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Validate a workspace against its template
   */
  validate(workspacePath: string, templateName: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    const templatePath = this.findTemplate(templateName);
    if (!templatePath) {
      return { valid: false, issues: [`Template not found: ${templateName}`] };
    }

    let manifest: TemplateManifest;
    try {
      manifest = this.loadManifest(join(templatePath, 'manifest.yaml'));
    } catch (error) {
      return { valid: false, issues: [`Invalid manifest: ${error}`] };
    }

    // Check that expected files exist
    for (const output of manifest.outputs) {
      const destPath = join(workspacePath, output.destination);
      if (!existsSync(destPath)) {
        issues.push(`Missing file: ${output.destination}`);
      }
    }

    return { valid: issues.length === 0, issues };
  }
}

// Export default instance
export const templateEngine = new TemplateEngine();
