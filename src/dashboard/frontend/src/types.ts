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
  'Backlog': 'backlog',
  'Todo': 'todo',
  'To Do': 'todo',
  'In Progress': 'in_progress',
  'Started': 'in_progress',
  'In Review': 'in_review',
  'Done': 'done',
  'Completed': 'done',
};
