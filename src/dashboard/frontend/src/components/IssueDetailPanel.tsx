import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  X,
  ExternalLink,
  Play,
  User,
  Tag,
  Calendar,
  Copy,
  Check,
  FolderPlus,
  Loader2,
  Folder,
  GitBranch,
  Globe,
  Terminal,
  Box,
  Database,
  Server,
  GitMerge,
  Bot,
} from 'lucide-react';
import { Issue, GitStatus } from '../types';

interface ContainerStatus {
  running: boolean;
  uptime: string | null;
}

interface RepoGitStatus {
  frontend: GitStatus | null;
  api: GitStatus | null;
}

interface WorkspaceInfo {
  exists: boolean;
  issueId: string;
  path?: string;
  frontendUrl?: string;
  apiUrl?: string;
  mrUrl?: string | null;
  hasAgent?: boolean;
  agentSessionId?: string | null;
  agentModel?: string;
  git?: GitStatus;
  repoGit?: RepoGitStatus;
  services?: { name: string; url?: string }[];
  containers?: Record<string, ContainerStatus> | null;
  hasDocker?: boolean;
  canContainerize?: boolean;
}

interface IssueDetailPanelProps {
  issue: Issue;
  onClose: () => void;
  onStartAgent?: () => void;
}

// Clipboard helper that works without HTTPS
function copyToClipboard(text: string): boolean {
  // Try modern API first
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text);
    return true;
  }

  // Fallback for non-secure contexts (like HTTP over network IP)
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch {
    document.body.removeChild(textArea);
    return false;
  }
}

export function IssueDetailPanel({ issue, onClose, onStartAgent }: IssueDetailPanelProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  // Fetch workspace info
  const { data: workspace, isLoading: workspaceLoading } = useQuery<WorkspaceInfo>({
    queryKey: ['workspace', issue.identifier],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${issue.identifier}`);
      if (!res.ok) throw new Error('Failed to fetch workspace info');
      return res.json();
    },
    refetchInterval: 5000, // Check for workspace changes
  });

  const handleCopyIdentifier = () => {
    copyToClipboard(issue.identifier);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPath = () => {
    if (workspace?.path) {
      copyToClipboard(`cd ${workspace.path}`);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  const startAgentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: issue.identifier, projectId: issue.project?.id }),
      });
      if (!res.ok) throw new Error('Failed to start agent');
      return res.json();
    },
    onSuccess: () => {
      // Refresh agents list after a short delay to allow tmux session to start
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['agents'] });
      }, 2000);
      onStartAgent?.();
    },
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: issue.identifier, projectId: issue.project?.id }),
      });
      if (!res.ok) throw new Error('Failed to create workspace');
      return res.json();
    },
    onSuccess: () => {
      // Refresh workspace info
      queryClient.invalidateQueries({ queryKey: ['workspace', issue.identifier] });
    },
  });

  const containerizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspaces/${issue.identifier}/containerize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to containerize workspace');
      }
      return res.json();
    },
    onSuccess: () => {
      // Refresh workspace info after a delay to allow script to complete
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['workspace', issue.identifier] });
      }, 3000);
    },
  });

  const startContainersMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspaces/${issue.identifier}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start containers');
      }
      return res.json();
    },
    onSuccess: () => {
      // Refresh workspace info after a delay to allow containers to start
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['workspace', issue.identifier] });
      }, 5000);
    },
  });

  const handleStartAgent = () => {
    startAgentMutation.mutate();
  };

  const handleCreateWorkspace = () => {
    createWorkspaceMutation.mutate();
  };

  const handleContainerize = () => {
    containerizeMutation.mutate();
  };

  const handleStartContainers = () => {
    startContainersMutation.mutate();
  };

  const priorityLabels: Record<number, { label: string; color: string }> = {
    0: { label: 'No priority', color: 'text-gray-400' },
    1: { label: 'Urgent', color: 'text-red-400' },
    2: { label: 'High', color: 'text-orange-400' },
    3: { label: 'Medium', color: 'text-yellow-400' },
    4: { label: 'Low', color: 'text-blue-400' },
  };

  const priority = priorityLabels[issue.priority] || priorityLabels[0];

  return (
    <div className="flex flex-col h-full bg-gray-800 border-l border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyIdentifier}
            className={`font-mono text-sm font-medium transition-colors ${
              copied ? 'text-green-400' : 'text-white hover:text-blue-400'
            }`}
            title="Click to copy"
          >
            {issue.identifier}
            {copied ? (
              <Check className="w-3 h-3 inline ml-1" />
            ) : (
              <Copy className="w-3 h-3 inline ml-1 opacity-50" />
            )}
          </button>
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-400"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Title */}
        <h2 className="text-lg font-medium text-white mb-4">{issue.title}</h2>

        {/* Status & Priority */}
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2 py-1 bg-gray-700 text-white text-xs rounded">
            {issue.status}
          </span>
          <span className={`text-xs ${priority.color}`}>{priority.label}</span>
        </div>

        {/* Meta info */}
        <div className="space-y-3 mb-6">
          {issue.assignee && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300">{issue.assignee.name}</span>
              <span className="text-gray-500 text-xs">{issue.assignee.email}</span>
            </div>
          )}

          {issue.labels.length > 0 && (
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <Tag className="w-4 h-4 text-gray-400 shrink-0" />
              {issue.labels.map((label) => (
                <span
                  key={label}
                  className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>Updated {new Date(issue.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Description */}
        {issue.description && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Description</h3>
            <div className="text-sm text-gray-300 bg-gray-900 rounded p-3 max-h-64 overflow-y-auto prose prose-sm prose-invert prose-p:my-2 prose-headings:my-2 prose-ul:my-1 prose-li:my-0">
              <ReactMarkdown>{issue.description}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Loading skeleton while fetching workspace info */}
        {workspaceLoading && (
          <div className="bg-gray-700/30 border border-gray-600/50 rounded-lg p-4 mb-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gray-600 rounded-full shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-4 bg-gray-600 rounded w-32" />
                <div className="h-3 bg-gray-600 rounded w-full" />
                <div className="h-3 bg-gray-600 rounded w-3/4" />
                <div className="flex gap-2 mt-3">
                  <div className="h-6 bg-gray-600 rounded w-20" />
                  <div className="h-6 bg-gray-600 rounded w-16" />
                  <div className="h-6 bg-gray-600 rounded w-24" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Workspace Info - Show when workspace exists */}
        {!workspaceLoading && workspace?.exists && (
          <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-900/50 rounded-full flex items-center justify-center shrink-0">
                <Folder className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-medium text-green-400">Workspace Ready</h4>
                  {!workspace.hasDocker && (
                    <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                      Git only
                    </span>
                  )}
                  {workspace.hasDocker && (
                    <span className="px-2 py-0.5 bg-purple-900/50 text-purple-400 text-xs rounded">
                      Containerized
                    </span>
                  )}
                  {workspace.hasAgent && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-900/50 text-blue-400 text-xs rounded">
                      <Bot className="w-3 h-3" />
                      {workspace.agentModel || 'Agent'}
                    </span>
                  )}
                </div>

                {/* Path with copy button */}
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded truncate flex-1">
                    {workspace.path}
                  </code>
                  <button
                    onClick={handleCopyPath}
                    className="text-gray-400 hover:text-white p-1"
                    title="Copy cd command"
                  >
                    {copiedPath ? <Check className="w-4 h-4 text-green-400" /> : <Terminal className="w-4 h-4" />}
                  </button>
                </div>

                {/* Service URLs - only show if containers are running */}
                {workspace.containers && Object.values(workspace.containers).some(c => c.running) && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Services</p>
                    {workspace.frontendUrl && workspace.containers?.frontend?.running && (
                      <a
                        href={workspace.frontendUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                      >
                        <Globe className="w-3 h-3" />
                        Frontend: {workspace.frontendUrl}
                      </a>
                    )}
                    {workspace.apiUrl && workspace.containers?.api?.running && (
                      <a
                        href={workspace.apiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                      >
                        <Server className="w-3 h-3" />
                        API: {workspace.apiUrl}
                      </a>
                    )}
                  </div>
                )}

                {/* MR URL - always show if available */}
                {workspace.mrUrl && (
                  <div className="mt-3">
                    <a
                      href={workspace.mrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
                    >
                      <GitMerge className="w-3 h-3" />
                      Merge Request
                    </a>
                  </div>
                )}

                {/* Start containers button when not running */}
                {workspace.hasDocker && (!workspace.containers || !Object.values(workspace.containers).some(c => c.running)) && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-yellow-500">Containers not running.</span>
                      <button
                        onClick={handleStartContainers}
                        disabled={startContainersMutation.isPending}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white text-xs rounded transition-colors"
                      >
                        {startContainersMutation.isPending ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Starting...
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            Start Containers
                          </>
                        )}
                      </button>
                    </div>
                    {startContainersMutation.isError && (
                      <div className="text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded">
                        {startContainersMutation.error instanceof Error
                          ? startContainersMutation.error.message
                          : 'Failed to start containers'}
                      </div>
                    )}
                  </div>
                )}

                {/* Git-only workspace info with containerize option */}
                {!workspace.hasDocker && (
                  <div className="mt-3">
                    {workspace.canContainerize ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">Git-only workspace.</span>
                          <button
                            onClick={handleContainerize}
                            disabled={containerizeMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white text-xs rounded transition-colors"
                          >
                            {containerizeMutation.isPending ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Setting up...
                              </>
                            ) : (
                              <>
                                <Box className="w-3 h-3" />
                                Containerize
                              </>
                            )}
                          </button>
                        </div>
                        {containerizeMutation.isError && (
                          <div className="text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded">
                            {containerizeMutation.error instanceof Error
                              ? containerizeMutation.error.message
                              : 'Failed to containerize workspace'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        This is a git-only workspace (no containers).
                      </div>
                    )}
                  </div>
                )}

                {/* Container status */}
                {workspace.containers && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Containers</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(workspace.containers).map(([name, status]) => {
                        const isStarting = startContainersMutation.isPending && !status.running;
                        return (
                          <span
                            key={name}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                              status.running
                                ? 'bg-green-900/30 text-green-400'
                                : isStarting
                                ? 'bg-yellow-900/30 text-yellow-400 animate-pulse'
                                : 'bg-gray-700 text-gray-500'
                            }`}
                          >
                            {isStarting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : name === 'postgres' || name === 'redis' ? (
                              <Database className="w-3 h-3" />
                            ) : (
                              <Box className="w-3 h-3" />
                            )}
                            {name}
                            {status.running && status.uptime && (
                              <span className="text-gray-400 ml-1">{status.uptime}</span>
                            )}
                            {isStarting && (
                              <span className="text-yellow-500 ml-1">starting...</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Git status for sub-repos */}
                {workspace.repoGit && (workspace.repoGit.frontend || workspace.repoGit.api) && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Git Status</p>
                    {workspace.repoGit.frontend && (
                      <div className="text-xs">
                        <span className="text-gray-400">Frontend:</span>
                        <span className="flex items-center gap-2 mt-0.5">
                          <GitBranch className="w-3 h-3 text-gray-500" />
                          <span className="text-gray-300">{workspace.repoGit.frontend.branch}</span>
                          {workspace.repoGit.frontend.uncommittedFiles > 0 && (
                            <span className="text-yellow-400">
                              {workspace.repoGit.frontend.uncommittedFiles} uncommitted
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {workspace.repoGit.api && (
                      <div className="text-xs">
                        <span className="text-gray-400">API:</span>
                        <span className="flex items-center gap-2 mt-0.5">
                          <GitBranch className="w-3 h-3 text-gray-500" />
                          <span className="text-gray-300">{workspace.repoGit.api.branch}</span>
                          {workspace.repoGit.api.uncommittedFiles > 0 && (
                            <span className="text-yellow-400">
                              {workspace.repoGit.api.uncommittedFiles} uncommitted
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Fallback to main git status if no sub-repos */}
                {workspace.git && !workspace.repoGit?.frontend && !workspace.repoGit?.api && (
                  <div className="flex items-center gap-3 mt-3 text-xs">
                    <span className="flex items-center gap-1 text-gray-400">
                      <GitBranch className="w-3 h-3" />
                      {workspace.git.branch}
                    </span>
                    {workspace.git.uncommittedFiles > 0 && (
                      <span className="text-yellow-400">
                        {workspace.git.uncommittedFiles} uncommitted
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No Agent Warning - Only show when no workspace */}
        {!workspace?.exists && !workspaceLoading && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-yellow-900/50 rounded-full flex items-center justify-center shrink-0">
                <Play className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-yellow-400">No Workspace</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Create a workspace or start an agent to begin work.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons - Only show when workspace data is loaded */}
        {workspaceLoading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-12 bg-gray-600 rounded-lg w-full" />
            <div className="h-12 bg-gray-700 rounded-lg w-full" />
          </div>
        )}

        {!workspaceLoading && (
        <div className="space-y-3">
          {/* Start Agent Button */}
          <button
            onClick={handleStartAgent}
            disabled={startAgentMutation.isPending || startAgentMutation.isSuccess}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {startAgentMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Starting...</span>
              </>
            ) : startAgentMutation.isSuccess ? (
              <>
                <Check className="w-5 h-5" />
                <span className="font-medium">Agent Started!</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span className="font-medium">{workspace?.exists ? 'Start Agent in Workspace' : 'Start Agent'}</span>
              </>
            )}
          </button>

          {/* Create Workspace Button - Only show when no workspace */}
          {!workspace?.exists && (
            <button
              onClick={handleCreateWorkspace}
              disabled={createWorkspaceMutation.isPending || createWorkspaceMutation.isSuccess}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createWorkspaceMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">Creating...</span>
                </>
              ) : createWorkspaceMutation.isSuccess ? (
                <>
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Workspace Created!</span>
                </>
              ) : (
                <>
                  <FolderPlus className="w-5 h-5" />
                  <span className="font-medium">Create Workspace Only</span>
                </>
              )}
            </button>
          )}

          {/* Error messages */}
          {startAgentMutation.isError && (
            <p className="text-red-400 text-xs">Failed to start agent. Check server logs.</p>
          )}
          {createWorkspaceMutation.isError && (
            <p className="text-red-400 text-xs">Failed to create workspace. Check server logs.</p>
          )}
        </div>
        )}

        {!workspaceLoading && (
        <div className="text-xs text-gray-500 mt-3 space-y-1">
          <p>
            <strong>Start Agent:</strong> {workspace?.exists ? 'Starts autonomous agent in existing workspace' : 'Creates workspace + starts autonomous agent'}
          </p>
          {!workspace?.exists && (
            <p>
              <strong>Create Workspace:</strong> Creates git worktree for manual work
            </p>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
