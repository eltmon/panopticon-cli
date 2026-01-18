import { execSync } from 'child_process';

export interface TmuxSession {
  name: string;
  created: Date;
  attached: boolean;
  windows: number;
}

export function listSessions(): TmuxSession[] {
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}|#{session_created}|#{session_attached}|#{session_windows}"', {
      encoding: 'utf8',
    });

    return output.trim().split('\n').filter(Boolean).map(line => {
      const [name, created, attached, windows] = line.split('|');
      return {
        name,
        created: new Date(parseInt(created) * 1000),
        attached: attached === '1',
        windows: parseInt(windows),
      };
    });
  } catch {
    return []; // No sessions
  }
}

export function sessionExists(name: string): boolean {
  try {
    execSync(`tmux has-session -t ${name} 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

export function createSession(name: string, cwd: string, initialCommand?: string): void {
  const escapedCwd = cwd.replace(/"/g, '\\"');
  const cmd = initialCommand
    ? `tmux new-session -d -s ${name} -c "${escapedCwd}" "${initialCommand.replace(/"/g, '\\"')}"`
    : `tmux new-session -d -s ${name} -c "${escapedCwd}"`;

  execSync(cmd);
}

export function killSession(name: string): void {
  execSync(`tmux kill-session -t ${name}`);
}

export function sendKeys(sessionName: string, keys: string): void {
  // CRITICAL: Send keys and Enter as separate commands
  // This is the correct way - combining them doesn't work
  const escapedKeys = keys.replace(/"/g, '\\"');
  execSync(`tmux send-keys -t ${sessionName} "${escapedKeys}"`);
  execSync(`tmux send-keys -t ${sessionName} Enter`);
}

export function capturePane(sessionName: string, lines: number = 50): string {
  try {
    return execSync(`tmux capture-pane -t ${sessionName} -p -S -${lines}`, {
      encoding: 'utf8',
    });
  } catch {
    return '';
  }
}

export function getAgentSessions(): TmuxSession[] {
  return listSessions().filter(s => s.name.startsWith('agent-'));
}
