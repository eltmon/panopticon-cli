import express from 'express';
import cors from 'cors';
import { execSync, spawn } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

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
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ error: 'Failed to fetch issues: ' + error.message });
  }
});

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
