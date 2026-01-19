import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Issue, Agent, LinearProject, STATUS_ORDER, STATUS_LABELS } from '../types';
import { ExternalLink, User, Tag, Play, Eye, MessageCircle, X, Loader2, Filter } from 'lucide-react';

async function fetchIssues(): Promise<Issue[]> {
  const res = await fetch('/api/issues');
  if (!res.ok) throw new Error('Failed to fetch issues');
  return res.json();
}

async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch('/api/agents');
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

function groupByStatus(issues: Issue[]): Record<string, Issue[]> {
  const grouped: Record<string, Issue[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
  };

  for (const issue of issues) {
    const status = STATUS_LABELS[issue.status] || 'backlog';
    grouped[status].push(issue);
  }

  return grouped;
}

const COLUMN_COLORS: Record<string, string> = {
  backlog: 'border-gray-600',
  todo: 'border-blue-600',
  in_progress: 'border-yellow-500',
  in_review: 'border-purple-500',
  done: 'border-green-500',
};

const COLUMN_TITLES: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

interface KanbanBoardProps {
  selectedIssue?: string | null;
  onSelectIssue?: (issueId: string | null) => void;
}

export function KanbanBoard({ selectedIssue: externalSelectedIssue, onSelectIssue: externalOnSelectIssue }: KanbanBoardProps) {
  const [internalSelectedIssue, setInternalSelectedIssue] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set()); // Empty = all projects

  // Use external state if provided, otherwise use internal state
  const selectedIssue = externalSelectedIssue !== undefined ? externalSelectedIssue : internalSelectedIssue;
  const onSelectIssue = externalOnSelectIssue || setInternalSelectedIssue;

  const { data: issues, isLoading: issuesLoading, error: issuesError } = useQuery({
    queryKey: ['issues'],
    queryFn: fetchIssues,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Extract unique projects from issues
  const projects = useMemo(() => {
    if (!issues) return [];
    const projectMap = new Map<string, LinearProject>();
    for (const issue of issues) {
      if (issue.project && !projectMap.has(issue.project.id)) {
        projectMap.set(issue.project.id, issue.project);
      }
    }
    return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [issues]);

  // Filter issues by selected projects
  const filteredIssues = useMemo(() => {
    if (!issues) return [];
    if (selectedProjects.size === 0) return issues; // Show all if none selected
    return issues.filter(issue => issue.project && selectedProjects.has(issue.project.id));
  }, [issues, selectedProjects]);

  const toggleProject = (projectId: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  if (issuesLoading) {
    return (
      <div className="space-y-4">
        {/* Skeleton filter bar */}
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-4 h-4 bg-gray-700 rounded" />
          <div className="w-16 h-4 bg-gray-700 rounded" />
          <div className="w-24 h-6 bg-gray-700 rounded" />
          <div className="w-20 h-6 bg-gray-700 rounded" />
          <div className="w-28 h-6 bg-gray-700 rounded" />
        </div>

        {/* Skeleton columns */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="flex-shrink-0 w-80">
              <div className={`border-t-4 ${COLUMN_COLORS[status]} bg-gray-800 rounded-lg`}>
                <div className="px-4 py-3 border-b border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="h-5 bg-gray-700 rounded w-24 animate-pulse" />
                    <div className="h-4 bg-gray-700 rounded w-6 animate-pulse" />
                  </div>
                </div>
                <div className="p-2 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-gray-700 rounded-lg p-3 border-l-4 border-l-gray-600 animate-pulse">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-gray-600 rounded-full" />
                        <div className="h-4 bg-gray-600 rounded w-16" />
                      </div>
                      <div className="h-4 bg-gray-600 rounded w-full mb-1" />
                      <div className="h-4 bg-gray-600 rounded w-3/4" />
                      <div className="flex gap-2 mt-3">
                        <div className="h-5 bg-gray-600 rounded w-16" />
                        <div className="h-5 bg-gray-600 rounded w-12" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (issuesError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Error loading issues: {(issuesError as Error).message}</div>
      </div>
    );
  }

  const grouped = groupByStatus(filteredIssues);

  return (
    <div className="space-y-4">
      {/* Project filter bar */}
      {projects.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Projects:</span>
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => toggleProject(project.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                selectedProjects.size === 0 || selectedProjects.has(project.id)
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-800 text-gray-500 hover:text-gray-300'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: project.color || '#6b7280' }}
              />
              {project.name}
            </button>
          ))}
          {selectedProjects.size > 0 && (
            <button
              onClick={() => setSelectedProjects(new Set())}
              className="text-xs text-gray-400 hover:text-white ml-2"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUS_ORDER.map((status) => (
        <div key={status} className="flex-shrink-0 w-80">
          <div className={`border-t-4 ${COLUMN_COLORS[status]} bg-gray-800 rounded-lg`}>
            <div className="px-4 py-3 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">{COLUMN_TITLES[status]}</h3>
                <span className="text-sm text-gray-400">{grouped[status].length}</span>
              </div>
            </div>
            <div className="p-2 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
              {grouped[status].map((issue) => {
                const agent = agents.find(
                  (a) => a.issueId?.toLowerCase() === issue.identifier.toLowerCase()
                );
                return (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    agent={agent}
                    isSelected={selectedIssue === issue.identifier}
                    onSelect={() => onSelectIssue(
                      selectedIssue === issue.identifier ? null : issue.identifier
                    )}
                  />
                );
              })}
              {grouped[status].length === 0 && (
                <div className="text-center text-gray-500 py-8 text-sm">
                  No issues
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

interface IssueCardProps {
  issue: Issue;
  agent?: Agent;
  isSelected: boolean;
  onSelect: () => void;
}

function IssueCard({ issue, agent, isSelected, onSelect }: IssueCardProps) {
  const queryClient = useQueryClient();
  const isRunning = agent && agent.status !== 'dead';

  const priorityColors: Record<number, string> = {
    0: 'border-l-gray-500',
    1: 'border-l-red-500',
    2: 'border-l-orange-500',
    3: 'border-l-yellow-500',
    4: 'border-l-blue-500',
  };

  // Kill agent mutation
  const killMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to kill agent');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  // Send message mutation
  const [messageInput, setMessageInput] = useState('');
  const [showMessageInput, setShowMessageInput] = useState(false);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ agentId, message }: { agentId: string; message: string }) => {
      const res = await fetch(`/api/agents/${agentId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      setMessageInput('');
      setShowMessageInput(false);
    },
  });

  const handleKill = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (agent && confirm(`Kill agent ${agent.id}?`)) {
      killMutation.mutate(agent.id);
    }
  };

  const handleWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  const handleTell = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMessageInput(!showMessageInput);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (agent && messageInput.trim()) {
      sendMessageMutation.mutate({ agentId: agent.id, message: messageInput.trim() });
    }
  };

  const handleStartAgent = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement agent start via pan work-issue
    alert(`Start agent for ${issue.identifier}? (Not yet implemented - use CLI: pan work-issue ${issue.identifier})`);
  };

  return (
    <div
      onClick={onSelect}
      className={`bg-gray-700 rounded-lg p-3 border-l-4 cursor-pointer transition-all ${priorityColors[issue.priority] || 'border-l-gray-500'} ${
        isSelected
          ? 'ring-2 ring-blue-500 bg-gray-650'
          : 'hover:bg-gray-650'
      } ${isRunning ? 'bg-blue-900/20' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Project color indicator */}
            {issue.project && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: issue.project.color || '#6b7280' }}
                title={issue.project.name}
              />
            )}
            {isRunning && (
              <div className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-white hover:text-blue-400 flex items-center gap-1"
            >
              <span className="text-gray-400">{issue.identifier}</span>
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
            {agent && (
              <span className="text-xs text-blue-400">{agent.model}</span>
            )}
          </div>
          <p className="text-sm text-gray-300 mt-1 line-clamp-2">{issue.title}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {issue.assignee && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <User className="w-3 h-3" />
            {issue.assignee.name.split(' ')[0]}
          </span>
        )}
        {issue.labels.slice(0, 2).map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded"
          >
            <Tag className="w-3 h-3" />
            {label}
          </span>
        ))}
      </div>

      {/* Action buttons for running agents */}
      {isRunning && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-600">
          <button
            onClick={handleWatch}
            className={`flex items-center gap-1 text-xs transition-colors ${
              isSelected ? 'text-blue-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Watch
          </button>
          <button
            onClick={handleTell}
            className={`flex items-center gap-1 text-xs transition-colors ${
              showMessageInput ? 'text-blue-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Tell
          </button>
          <button
            onClick={handleKill}
            disabled={killMutation.isPending}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors ml-auto"
          >
            {killMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
            Kill
          </button>
        </div>
      )}

      {/* Message input for Tell */}
      {showMessageInput && agent && (
        <form onSubmit={handleSendMessage} className="mt-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-800 text-white text-sm px-3 py-1.5 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || sendMessageMutation.isPending}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendMessageMutation.isPending ? '...' : 'Send'}
            </button>
          </div>
        </form>
      )}

      {/* Start button for backlog/todo items without running agent */}
      {!isRunning && (STATUS_LABELS[issue.status] === 'backlog' || STATUS_LABELS[issue.status] === 'todo') && (
        <div className="mt-3 pt-3 border-t border-gray-600">
          <button
            onClick={handleStartAgent}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Start Agent
          </button>
        </div>
      )}
    </div>
  );
}
