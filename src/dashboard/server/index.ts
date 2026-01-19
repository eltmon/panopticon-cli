import express from 'express';
import cors from 'cors';
import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync, readdirSync, appendFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Activity log for tracking pan command output
const ACTIVITY_LOG = '/tmp/panopticon-activity.log';

interface ActivityEntry {
  id: string;
  timestamp: string;
  command: string;
  status: 'running' | 'completed' | 'failed';
  output: string[];
}

// In-memory activity store (last 50 entries)
const activities: ActivityEntry[] = [];
const MAX_ACTIVITIES = 50;

function logActivity(entry: ActivityEntry) {
  activities.unshift(entry);
  if (activities.length > MAX_ACTIVITIES) {
    activities.pop();
  }
}

function updateActivity(id: string, updates: Partial<ActivityEntry>) {
  const activity = activities.find(a => a.id === id);
  if (activity) {
    Object.assign(activity, updates);
  }
}

function appendActivityOutput(id: string, line: string) {
  const activity = activities.find(a => a.id === id);
  if (activity) {
    activity.output.push(line);
    // Keep only last 100 lines per activity
    if (activity.output.length > 100) {
      activity.output.shift();
    }
  }
}

// Get the first registered project path from pan
function getDefaultProjectPath(): string {
  try {
    const projectsFile = join(homedir(), '.panopticon', 'projects.json');
    if (existsSync(projectsFile)) {
      const projects = JSON.parse(readFileSync(projectsFile, 'utf-8'));
      if (Array.isArray(projects) && projects.length > 0) {
        return projects[0].path;
      }
    }
  } catch {}
  return homedir();
}

// Spawn a pan command and track its output
function spawnPanCommand(args: string[], description: string, cwd?: string): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();
  const command = `pan ${args.join(' ')}`;
  const workingDir = cwd || homedir();

  logActivity({
    id,
    timestamp,
    command,
    status: 'running',
    output: [`[${timestamp}] Starting: ${command}`, `[cwd] ${workingDir}`],
  });

  const child = spawn('pan', args, {
    cwd: workingDir,
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter((l: string) => l.trim());
    lines.forEach((line: string) => appendActivityOutput(id, line));
  });

  child.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n').filter((l: string) => l.trim());
    lines.forEach((line: string) => appendActivityOutput(id, `[stderr] ${line}`));
  });

  child.on('close', (code) => {
    const status = code === 0 ? 'completed' : 'failed';
    appendActivityOutput(id, `[${new Date().toISOString()}] Process exited with code ${code}`);
    updateActivity(id, { status });
  });

  child.on('error', (err) => {
    appendActivityOutput(id, `[error] ${err.message}`);
    updateActivity(id, { status: 'failed' });
  });

  return id;
}

const app = express();
const PORT = parseInt(process.env.PORT || '3002', 10);

app.use(cors());
app.use(express.json());

// Load Linear API key from ~/.panopticon.env or environment
function getLinearApiKey(): string | null {
  const envFile = join(homedir(), '.panopticon.env');
  if (existsSync(envFile)) {
    const content = readFileSync(envFile, 'utf-8');
    const match = content.match(/LINEAR_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  return process.env.LINEAR_API_KEY || null;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get Linear issues using raw GraphQL for efficiency (single query with all data)
app.get('/api/issues', async (_req, res) => {
  try {
    const apiKey = getLinearApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'LINEAR_API_KEY not configured' });
    }

    // Use raw GraphQL to fetch all data in one query per page (no lazy loading)
    const allIssues: any[] = [];
    let hasMore = true;
    let cursor: string | undefined;

    while (hasMore) {
      const query = `
        query GetIssues($after: String) {
          issues(first: 100, after: $after, orderBy: updatedAt) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              identifier
              title
              description
              priority
              url
              createdAt
              updatedAt
              state {
                name
              }
              assignee {
                name
                email
              }
              labels {
                nodes {
                  name
                }
              }
              project {
                id
                name
                color
                icon
              }
              team {
                id
                name
                color
                icon
              }
            }
          }
        }
      `;

      const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({ query, variables: { after: cursor } }),
      });

      const json = await response.json();

      if (json.errors) {
        console.error('GraphQL errors:', json.errors);
        throw new Error(json.errors[0]?.message || 'GraphQL error');
      }

      const issues = json.data?.issues;
      if (!issues) break;

      allIssues.push(...issues.nodes);
      hasMore = issues.pageInfo.hasNextPage;
      cursor = issues.pageInfo.endCursor;

      // Safety limit
      if (allIssues.length > 1000) break;
    }

    console.log(`Fetched ${allIssues.length} issues`);

    // Format issues (data is already resolved, no extra API calls)
    const formatted = allIssues.map((issue: any) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      status: issue.state?.name || 'Backlog',
      priority: issue.priority,
      assignee: issue.assignee ? { name: issue.assignee.name, email: issue.assignee.email } : undefined,
      labels: issue.labels?.nodes?.map((l: any) => l.name) || [],
      url: issue.url,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      // Use project if available, otherwise fall back to team
      project: issue.project ? {
        id: issue.project.id,
        name: issue.project.name,
        color: issue.project.color,
        icon: issue.project.icon,
      } : issue.team ? {
        id: issue.team.id,
        name: issue.team.name,
        color: issue.team.color,
        icon: issue.team.icon,
      } : undefined,
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues: ' + error.message });
  }
});

// Get project mappings (Linear project -> local directory)
const PROJECT_MAPPINGS_FILE = join(homedir(), '.panopticon', 'project-mappings.json');

interface ProjectMapping {
  linearProjectId: string;
  linearProjectName: string;
  linearPrefix: string;  // e.g., "MIN"
  localPath: string;
}

function getProjectMappings(): ProjectMapping[] {
  try {
    if (existsSync(PROJECT_MAPPINGS_FILE)) {
      return JSON.parse(readFileSync(PROJECT_MAPPINGS_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveProjectMappings(mappings: ProjectMapping[]) {
  const dir = join(homedir(), '.panopticon');
  if (!existsSync(dir)) {
    require('fs').mkdirSync(dir, { recursive: true });
  }
  writeFileSync(PROJECT_MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
}

// Get all project mappings
app.get('/api/project-mappings', (_req, res) => {
  res.json(getProjectMappings());
});

// Update project mappings
app.put('/api/project-mappings', (req, res) => {
  const mappings = req.body;
  if (!Array.isArray(mappings)) {
    return res.status(400).json({ error: 'Expected array of mappings' });
  }
  saveProjectMappings(mappings);
  res.json({ success: true, mappings });
});

// Add or update a single project mapping
app.post('/api/project-mappings', (req, res) => {
  const { linearProjectId, linearProjectName, linearPrefix, localPath } = req.body;
  if (!linearProjectId || !localPath) {
    return res.status(400).json({ error: 'linearProjectId and localPath required' });
  }

  const mappings = getProjectMappings();
  const existing = mappings.findIndex(m => m.linearProjectId === linearProjectId);

  const mapping: ProjectMapping = {
    linearProjectId,
    linearProjectName: linearProjectName || '',
    linearPrefix: linearPrefix || '',
    localPath,
  };

  if (existing >= 0) {
    mappings[existing] = mapping;
  } else {
    mappings.push(mapping);
  }

  saveProjectMappings(mappings);
  res.json({ success: true, mapping });
});

// Get local path for a Linear project (used when creating workspaces)
function getProjectPath(linearProjectId?: string, issuePrefix?: string): string {
  const mappings = getProjectMappings();

  // Try to find by project ID first
  if (linearProjectId) {
    const mapping = mappings.find(m => m.linearProjectId === linearProjectId);
    if (mapping) return mapping.localPath;
  }

  // Try to find by issue prefix (e.g., "MIN" from "MIN-645")
  if (issuePrefix) {
    const mapping = mappings.find(m => m.linearPrefix === issuePrefix);
    if (mapping) return mapping.localPath;
  }

  // Fall back to default project
  return getDefaultProjectPath();
}

// Get git status for a workspace path
function getGitStatus(workspacePath: string): { branch: string; uncommittedFiles: number; latestCommit: string } | null {
  try {
    if (!existsSync(workspacePath)) return null;

    const branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', {
      cwd: workspacePath,
      encoding: 'utf-8',
    }).trim();

    const uncommitted = execSync('git status --porcelain 2>/dev/null | wc -l', {
      cwd: workspacePath,
      encoding: 'utf-8',
    }).trim();

    const latestCommit = execSync('git log -1 --pretty=format:"%s" 2>/dev/null', {
      cwd: workspacePath,
      encoding: 'utf-8',
    }).trim();

    return {
      branch,
      uncommittedFiles: parseInt(uncommitted) || 0,
      latestCommit: latestCommit.slice(0, 60) + (latestCommit.length > 60 ? '...' : ''),
    };
  } catch {
    return null;
  }
}

// Get running agents from tmux sessions
app.get('/api/agents', (_req, res) => {
  try {
    const result = execSync('tmux list-sessions -F "#{session_name}|#{session_created}" 2>/dev/null || true', {
      encoding: 'utf-8',
    });

    const agents = result
      .trim()
      .split('\n')
      .filter((line) => line.startsWith('agent-'))
      .map((line) => {
        const [name, created] = line.split('|');
        const startedAt = new Date(parseInt(created) * 1000).toISOString();

        // Check agent state from ~/.panopticon/agents/
        const stateFile = join(homedir(), '.panopticon', 'agents', name, 'state.json');
        const healthFile = join(homedir(), '.panopticon', 'agents', name, 'health.json');
        let state: any = { runtime: 'claude', model: 'sonnet', workspace: process.cwd() };
        let health: any = { consecutiveFailures: 0, killCount: 0 };

        if (existsSync(stateFile)) {
          try {
            state = { ...state, ...JSON.parse(readFileSync(stateFile, 'utf-8')) };
          } catch {}
        }

        if (existsSync(healthFile)) {
          try {
            health = { ...health, ...JSON.parse(readFileSync(healthFile, 'utf-8')) };
          } catch {}
        }

        // Get git status for workspace
        const gitStatus = state.workspace ? getGitStatus(state.workspace) : null;

        return {
          id: name,
          issueId: name.replace('agent-', '').toUpperCase(),
          runtime: state.runtime || 'claude',
          model: state.model || 'sonnet',
          status: 'healthy' as const,
          startedAt,
          consecutiveFailures: health.consecutiveFailures || 0,
          killCount: health.killCount || 0,
          workspace: state.workspace || null,
          git: gitStatus,
        };
      });

    res.json(agents);
  } catch (error) {
    console.error('Error listing agents:', error);
    res.json([]);
  }
});

// Get agent output
app.get('/api/agents/:id/output', (req, res) => {
  const { id } = req.params;
  const lines = req.query.lines || 100;

  try {
    const output = execSync(
      `tmux capture-pane -t "${id}" -p -S -${lines} 2>/dev/null || echo "Session not found"`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    res.json({ output });
  } catch (error) {
    res.json({ output: 'Failed to capture output' });
  }
});

// Send message to agent
app.post('/api/agents/:id/message', (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  try {
    // Send message to tmux session
    execSync(`tmux send-keys -t "${id}" "${message.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
    });
    // Press Enter
    execSync(`tmux send-keys -t "${id}" Enter`, { encoding: 'utf-8' });

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Kill agent
app.delete('/api/agents/:id', (req, res) => {
  const { id } = req.params;

  try {
    execSync(`tmux kill-session -t "${id}" 2>/dev/null || true`, {
      encoding: 'utf-8',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error killing agent:', error);
    res.status(500).json({ error: 'Failed to kill agent' });
  }
});

// Check if a tmux session is alive and active
function checkAgentHealth(agentId: string): {
  alive: boolean;
  lastOutput?: string;
  outputAge?: number;
} {
  try {
    // Check if session exists
    execSync(`tmux has-session -t "${agentId}" 2>/dev/null`);

    // Get recent output to check if active
    const output = execSync(
      `tmux capture-pane -t "${agentId}" -p -S -5 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 }
    ).trim();

    return { alive: true, lastOutput: output };
  } catch {
    return { alive: false };
  }
}

// Determine health status based on activity
function determineHealthStatus(
  agentId: string,
  stateFile: string
): { status: 'healthy' | 'warning' | 'stuck' | 'dead'; reason?: string } {
  const health = checkAgentHealth(agentId);

  if (!health.alive) {
    return { status: 'dead', reason: 'Session not found' };
  }

  // Check if there's been recent output
  if (existsSync(stateFile)) {
    try {
      const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      const lastActivity = state.lastActivity ? new Date(state.lastActivity) : null;

      if (lastActivity) {
        const ageMs = Date.now() - lastActivity.getTime();
        const ageMinutes = ageMs / (1000 * 60);

        if (ageMinutes > 30) {
          return { status: 'stuck', reason: `No activity for ${Math.round(ageMinutes)} minutes` };
        } else if (ageMinutes > 15) {
          return { status: 'warning', reason: `Low activity (${Math.round(ageMinutes)} minutes)` };
        }
      }
    } catch {}
  }

  return { status: 'healthy' };
}

// Get agent health status
app.get('/api/health/agents', (_req, res) => {
  try {
    const agentsDir = join(homedir(), '.panopticon', 'agents');
    if (!existsSync(agentsDir)) {
      return res.json([]);
    }

    const agents = readdirSync(agentsDir)
      .filter((name) => name.startsWith('agent-'))
      .map((name) => {
        const stateFile = join(agentsDir, name, 'state.json');
        const healthFile = join(agentsDir, name, 'health.json');

        // Get stored health info
        let storedHealth = {
          consecutiveFailures: 0,
          killCount: 0,
        };
        if (existsSync(healthFile)) {
          try {
            storedHealth = { ...storedHealth, ...JSON.parse(readFileSync(healthFile, 'utf-8')) };
          } catch {}
        }

        // Check live status
        const { status, reason } = determineHealthStatus(name, stateFile);

        return {
          agentId: name,
          status,
          reason,
          lastPing: new Date().toISOString(),
          consecutiveFailures: storedHealth.consecutiveFailures,
          killCount: storedHealth.killCount,
        };
      });

    res.json(agents);
  } catch (error) {
    console.error('Error fetching health:', error);
    res.json([]);
  }
});

// Ping an agent to check if it's responsive
app.post('/api/health/agents/:id/ping', (req, res) => {
  const { id } = req.params;
  const health = checkAgentHealth(id);

  if (!health.alive) {
    return res.json({ success: false, status: 'dead' });
  }

  // Update last ping time in state file
  const stateFile = join(homedir(), '.panopticon', 'agents', id, 'state.json');
  if (existsSync(stateFile)) {
    try {
      const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
      state.lastPing = new Date().toISOString();
      require('fs').writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch {}
  }

  res.json({ success: true, status: 'healthy', hasOutput: !!health.lastOutput });
});

// Get activity log
app.get('/api/activity', (_req, res) => {
  res.json(activities);
});

// Get specific activity
app.get('/api/activity/:id', (req, res) => {
  const activity = activities.find(a => a.id === req.params.id);
  if (!activity) {
    return res.status(404).json({ error: 'Activity not found' });
  }
  res.json(activity);
});

// Get container status for workspace
function getContainerStatus(issueId: string): Record<string, { running: boolean; uptime: string | null }> {
  const issueLower = issueId.toLowerCase();
  const containerNames = ['frontend', 'api', 'postgres', 'redis'];
  const status: Record<string, { running: boolean; uptime: string | null }> = {};

  for (const name of containerNames) {
    try {
      // Try both naming conventions
      const patterns = [
        `myn-feature-${issueLower}-${name}-1`,
        `feature-${issueLower}-${name}-1`,
        `${issueLower}-${name}-1`,
      ];

      let found = false;
      for (const containerName of patterns) {
        const output = execSync(
          `docker ps -a --filter "name=${containerName}" --format "{{.Status}}" 2>/dev/null || echo ""`,
          { encoding: 'utf-8' }
        ).trim();

        if (output) {
          const isRunning = output.startsWith('Up');
          const uptime = isRunning ? output.replace(/^Up\s+/, '').split(/\s+/)[0] : null;
          status[name] = { running: isRunning, uptime };
          found = true;
          break;
        }
      }

      if (!found) {
        status[name] = { running: false, uptime: null };
      }
    } catch {
      status[name] = { running: false, uptime: null };
    }
  }

  return status;
}

// Get MR URL for an issue from GitLab
function getMrUrl(issueId: string, workspacePath: string): string | null {
  try {
    // Try to get MR from glab
    const output = execSync(`glab mr list -A -F json 2>/dev/null || echo "[]"`, {
      encoding: 'utf-8',
      cwd: workspacePath,
      maxBuffer: 10 * 1024 * 1024,
    });

    const mrs = JSON.parse(output);
    for (const mr of mrs) {
      // Match by source branch (e.g., feature/min-609 -> MIN-609)
      const branchMatch = mr.source_branch?.match(/feature\/(\w+-\d+)/i);
      if (branchMatch && branchMatch[1].toUpperCase() === issueId.toUpperCase()) {
        return mr.web_url;
      }
    }
  } catch {}

  return null;
}

// Get git status for sub-repos (frontend/api)
function getRepoGitStatus(workspacePath: string): {
  frontend: { branch: string; uncommittedFiles: number; latestCommit: string } | null;
  api: { branch: string; uncommittedFiles: number; latestCommit: string } | null;
} {
  const result: {
    frontend: { branch: string; uncommittedFiles: number; latestCommit: string } | null;
    api: { branch: string; uncommittedFiles: number; latestCommit: string } | null;
  } = { frontend: null, api: null };

  // Check for both 'fe'/'api' and 'frontend'/'backend' naming conventions
  const repoPaths = [
    { key: 'frontend', paths: ['fe', 'frontend'] },
    { key: 'api', paths: ['api', 'backend'] },
  ];

  for (const { key, paths } of repoPaths) {
    for (const subdir of paths) {
      const repoDir = join(workspacePath, subdir);
      if (!existsSync(repoDir)) continue;

      try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', {
          cwd: repoDir,
          encoding: 'utf-8',
        }).trim();

        const uncommitted = execSync('git status --porcelain 2>/dev/null | wc -l', {
          cwd: repoDir,
          encoding: 'utf-8',
        }).trim();

        const latestCommit = execSync('git log -1 --pretty=format:"%s" 2>/dev/null || echo ""', {
          cwd: repoDir,
          encoding: 'utf-8',
        }).trim();

        result[key as 'frontend' | 'api'] = {
          branch,
          uncommittedFiles: parseInt(uncommitted, 10) || 0,
          latestCommit: latestCommit.slice(0, 60) + (latestCommit.length > 60 ? '...' : ''),
        };
        break; // Found this repo, move to next
      } catch {}
    }
  }

  return result;
}

// Get workspace info for an issue
app.get('/api/workspaces/:issueId', (req, res) => {
  const { issueId } = req.params;
  const issuePrefix = issueId.split('-')[0];
  const projectPath = getProjectPath(undefined, issuePrefix);
  const issueLower = issueId.toLowerCase();

  // Convert issue ID to workspace path (e.g., MIN-645 -> feature-min-645)
  const workspaceName = `feature-${issueLower}`;
  const workspacePath = join(projectPath, 'workspaces', workspaceName);

  if (!existsSync(workspacePath)) {
    return res.json({ exists: false, issueId });
  }

  // Get git status for main workspace and sub-repos
  const git = getGitStatus(workspacePath);
  const repoGit = getRepoGitStatus(workspacePath);

  // Construct service URLs based on workspace naming convention
  const frontendUrl = `https://feature-${issueLower}.myn.test`;
  const apiUrl = `https://api-feature-${issueLower}.myn.test`;

  // Check for WORKSPACE.md to get custom service URLs
  let services: { name: string; url?: string }[] = [];
  const workspaceMd = join(workspacePath, 'WORKSPACE.md');
  const dockerCompose = join(workspacePath, 'docker-compose.yml');

  // Try to extract service URLs from WORKSPACE.md if it exists
  if (existsSync(workspaceMd)) {
    try {
      const content = readFileSync(workspaceMd, 'utf-8');
      // Look for URLs in the format: Frontend: http://... or Backend: http://...
      const urlMatches = content.matchAll(/(\w+):\s*(https?:\/\/[^\s\n]+)/gi);
      for (const match of urlMatches) {
        services.push({ name: match[1], url: match[2] });
      }
    } catch {}
  }

  // If no services from WORKSPACE.md, use constructed URLs
  if (services.length === 0) {
    services = [
      { name: 'Frontend', url: frontendUrl },
      { name: 'API', url: apiUrl },
    ];
  }

  // Check if docker-compose exists (indicates containerized workspace)
  // Look in multiple places: root, .devcontainer
  const hasDocker = existsSync(dockerCompose) ||
                    existsSync(join(workspacePath, '.devcontainer', 'docker-compose.yml')) ||
                    existsSync(join(workspacePath, '.devcontainer', 'compose.yaml'));

  // Get container status
  const containers = hasDocker ? getContainerStatus(issueId) : null;

  // Check if project supports containerization (has new-feature script)
  const canContainerize = !hasDocker && existsSync(join(projectPath, 'infra', 'new-feature'));

  // Get MR URL
  const mrUrl = getMrUrl(issueId, workspacePath);

  // Check for running agent
  let hasAgent = false;
  let agentSessionId: string | null = null;
  let agentModel: string | undefined;

  try {
    const sessions = execSync('tmux list-sessions 2>/dev/null || echo ""', { encoding: 'utf-8' });
    const agentSession = `agent-${issueLower}`;
    if (sessions.includes(agentSession)) {
      hasAgent = true;
      agentSessionId = agentSession;

      // Try to detect model from tmux output
      try {
        const paneOutput = execSync(
          `tmux capture-pane -t "${agentSession}" -p 2>/dev/null | tail -50`,
          { encoding: 'utf-8' }
        );
        const modelMatch = paneOutput.match(/\[(Opus|Sonnet|Haiku)[^\]]*\]/i);
        agentModel = modelMatch ? modelMatch[1] : undefined;
      } catch {}
    }
  } catch {}

  res.json({
    exists: true,
    issueId,
    path: workspacePath,
    frontendUrl,
    apiUrl,
    mrUrl,
    hasAgent,
    agentSessionId,
    agentModel,
    git,
    repoGit,
    services,
    containers,
    hasDocker,
    canContainerize,
  });
});

// Create workspace (without agent)
app.post('/api/workspaces', (req, res) => {
  const { issueId, projectId } = req.body;

  if (!issueId) {
    return res.status(400).json({ error: 'issueId required' });
  }

  try {
    // Extract prefix from issue ID (e.g., "MIN" from "MIN-645")
    const issuePrefix = issueId.split('-')[0];
    const projectPath = getProjectPath(projectId, issuePrefix);
    const activityId = spawnPanCommand(
      ['workspace', 'create', issueId],
      `Create workspace for ${issueId}`,
      projectPath
    );

    res.json({
      success: true,
      message: `Creating workspace for ${issueId}`,
      activityId,
      projectPath,
    });
  } catch (error: any) {
    console.error('Error creating workspace:', error);
    res.status(500).json({ error: 'Failed to create workspace: ' + error.message });
  }
});

// Containerize an existing workspace (runs project's new-feature script)
app.post('/api/workspaces/:issueId/containerize', (req, res) => {
  const { issueId } = req.params;
  const issuePrefix = issueId.split('-')[0];
  const projectPath = getProjectPath(undefined, issuePrefix);
  const issueLower = issueId.toLowerCase();

  // Check if new-feature script exists
  const newFeatureScript = join(projectPath, 'infra', 'new-feature');
  if (!existsSync(newFeatureScript)) {
    return res.status(400).json({
      error: 'Project does not support containerization (no infra/new-feature script)',
    });
  }

  // Check if already containerized
  const workspaceName = `feature-${issueLower}`;
  const workspacePath = join(projectPath, 'workspaces', workspaceName);
  if (existsSync(join(workspacePath, '.devcontainer'))) {
    return res.status(400).json({
      error: 'Workspace is already containerized',
    });
  }

  try {
    // First, remove the git-only workspace if it exists
    // The new-feature script will create a proper containerized one
    if (existsSync(workspacePath)) {
      // Run pan workspace destroy first to clean up the git worktree
      execSync(`pan workspace destroy ${issueId} --force 2>/dev/null || true`, {
        cwd: projectPath,
        encoding: 'utf-8',
      });
    }

    // Run the new-feature script from the infra directory
    // Extract just the issue identifier (e.g., "min-645" from "MIN-645")
    const featureName = issueLower;
    const activityId = Date.now().toString();
    const startTime = new Date();

    // Spawn the new-feature script
    const child = spawn('./new-feature', [featureName], {
      cwd: join(projectPath, 'infra'),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout?.on('data', (data) => {
      output += data.toString();
    });
    child.stderr?.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
      activityLog.unshift({
        id: activityId,
        command: `./new-feature ${featureName}`,
        description: `Containerize workspace for ${issueId}`,
        status: code === 0 ? 'completed' : 'failed',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration,
        output: output.slice(-5000), // Keep last 5KB
        projectPath: join(projectPath, 'infra'),
      });
      // Trim log to last 100 entries
      if (activityLog.length > 100) {
        activityLog.length = 100;
      }
    });

    // Add to activity log immediately as running
    activityLog.unshift({
      id: activityId,
      command: `./new-feature ${featureName}`,
      description: `Containerize workspace for ${issueId}`,
      status: 'running',
      startTime: startTime.toISOString(),
      projectPath: join(projectPath, 'infra'),
    });

    res.json({
      success: true,
      message: `Containerizing workspace for ${issueId}`,
      activityId,
      projectPath,
    });
  } catch (error: any) {
    console.error('Error containerizing workspace:', error);
    res.status(500).json({ error: 'Failed to containerize workspace: ' + error.message });
  }
});

// Start agent for issue
app.post('/api/agents', (req, res) => {
  const { issueId, projectId } = req.body;

  if (!issueId) {
    return res.status(400).json({ error: 'issueId required' });
  }

  try {
    // Extract prefix from issue ID (e.g., "MIN" from "MIN-645")
    const issuePrefix = issueId.split('-')[0];
    const projectPath = getProjectPath(projectId, issuePrefix);
    const activityId = spawnPanCommand(
      ['work', 'issue', issueId],
      `Start agent for ${issueId}`,
      projectPath
    );

    res.json({
      success: true,
      message: `Starting agent for ${issueId}`,
      activityId,
      projectPath,
    });
  } catch (error: any) {
    console.error('Error starting agent:', error);
    res.status(500).json({ error: 'Failed to start agent: ' + error.message });
  }
});

// Get skills
app.get('/api/skills', (_req, res) => {
  try {
    const skills: Array<{
      name: string;
      path: string;
      source: string;
      hasSkillMd: boolean;
      description?: string;
    }> = [];

    // Check both skill locations
    const skillLocations = [
      { path: join(homedir(), '.panopticon', 'skills'), source: 'panopticon' },
      { path: join(homedir(), '.claude', 'skills'), source: 'claude' },
    ];

    for (const { path: skillsDir, source } of skillLocations) {
      if (!existsSync(skillsDir)) continue;

      const entries = readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillPath = join(skillsDir, entry.name);
        const skillMdPath = join(skillPath, 'SKILL.md');
        const hasSkillMd = existsSync(skillMdPath);

        let description: string | undefined;
        if (hasSkillMd) {
          try {
            const content = readFileSync(skillMdPath, 'utf-8');
            // Extract first line or sentence as description
            const firstLine = content.split('\n').find(line =>
              line.trim() && !line.startsWith('#') && !line.startsWith('---')
            );
            description = firstLine?.trim().slice(0, 100);
          } catch {}
        }

        skills.push({
          name: entry.name,
          path: skillPath,
          source,
          hasSkillMd,
          description,
        });
      }
    }

    res.json(skills);
  } catch (error) {
    console.error('Error listing skills:', error);
    res.json([]);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Panopticon API server running on http://0.0.0.0:${PORT}`);
});
