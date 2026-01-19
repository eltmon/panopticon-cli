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
} from 'lucide-react';
import { Issue, GitStatus } from '../types';

interface WorkspaceInfo {
  exists: boolean;
  issueId: string;
  path?: string;
  git?: GitStatus;
  services?: { name: string; url?: string }[];
  hasDocker?: boolean;
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

  const handleStartAgent = () => {
    startAgentMutation.mutate();
  };

  const handleCreateWorkspace = () => {
    createWorkspaceMutation.mutate();
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

        {/* Workspace Info - Show when workspace exists */}
        {workspace?.exists && (
          <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-900/50 rounded-full flex items-center justify-center shrink-0">
                <Folder className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-green-400">Workspace Ready</h4>

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

                {/* Git status */}
                {workspace.git && (
                  <div className="flex items-center gap-3 mt-2 text-xs">
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

                {/* Service URLs */}
                {workspace.services && workspace.services.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Services</p>
                    {workspace.services.map((service, i) => (
                      <a
                        key={i}
                        href={service.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                      >
                        <Globe className="w-3 h-3" />
                        {service.name}: {service.url}
                      </a>
                    ))}
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

        {/* Action Buttons */}
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
      </div>
    </div>
  );
}
