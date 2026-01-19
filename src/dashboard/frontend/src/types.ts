export interface LinearProject {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface Issue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  assignee?: {
    name: string;
    email: string;
  };
  labels: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
  project?: LinearProject;
}

export interface GitStatus {
  branch: string;
  uncommittedFiles: number;
  latestCommit: string;
}

export interface Agent {
  id: string;
  issueId?: string;
  runtime: string;
  model: string;
  status: 'healthy' | 'warning' | 'stuck' | 'dead';
  pid?: number;
  startedAt: string;
  lastActivity?: string;
  consecutiveFailures: number;
  killCount: number;
  workspace?: string;
  git?: GitStatus;
}

export interface AgentHealth {
  agentId: string;
  status: 'healthy' | 'warning' | 'stuck' | 'dead';
  reason?: string;
  lastPing?: string;
  consecutiveFailures: number;
  killCount: number;
}

export interface Skill {
  name: string;
  path: string;
  source: 'panopticon' | 'claude';
  hasSkillMd: boolean;
  description?: string;
}

export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';

export const STATUS_ORDER: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

export const STATUS_LABELS: Record<string, IssueStatus> = {
  // Backlog states
  'Backlog': 'backlog',
  'Triage': 'backlog',
  'Unknown': 'backlog',

  // Todo states
  'Todo': 'todo',
  'To Do': 'todo',
  'Ready': 'todo',
  'Unstarted': 'todo',

  // In Progress states
  'In Progress': 'in_progress',
  'Started': 'in_progress',
  'Active': 'in_progress',

  // In Review states
  'In Review': 'in_review',
  'Review': 'in_review',
  'QA': 'in_review',
  'Testing': 'in_review',

  // Done states
  'Done': 'done',
  'Completed': 'done',
  'Closed': 'done',
  'Canceled': 'done',
  'Cancelled': 'done',
  'Duplicate': 'done',
};
