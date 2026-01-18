import { useState } from 'react';
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
} from 'lucide-react';
import { Issue } from '../types';

interface IssueDetailPanelProps {
  issue: Issue;
  onClose: () => void;
  onStartAgent?: () => void;
}

export function IssueDetailPanel({ issue, onClose, onStartAgent }: IssueDetailPanelProps) {
  const [copied, setCopied] = useState(false);
  const [copiedWorkspace, setCopiedWorkspace] = useState(false);

  const handleCopyIdentifier = () => {
    navigator.clipboard.writeText(issue.identifier);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartAgent = () => {
    // Copy the command to clipboard and show instructions
    const command = `pan work issue ${issue.identifier}`;
    navigator.clipboard.writeText(command);
    alert(`Command copied to clipboard:\n\n${command}\n\nRun this in your terminal to start an agent.`);
    onStartAgent?.();
  };

  const handleCreateWorkspace = () => {
    // Copy the workspace create command
    const command = `pan workspace create ${issue.identifier}`;
    navigator.clipboard.writeText(command);
    setCopiedWorkspace(true);
    setTimeout(() => setCopiedWorkspace(false), 2000);
    alert(`Command copied to clipboard:\n\n${command}\n\nRun this in your project directory to create a workspace without starting an agent.`);
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
            <div className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-900 rounded p-3 max-h-64 overflow-y-auto">
              {issue.description}
            </div>
          </div>
        )}

        {/* No Agent Warning */}
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-yellow-900/50 rounded-full flex items-center justify-center shrink-0">
              <Play className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-yellow-400">No Agent Running</h4>
              <p className="text-xs text-gray-400 mt-1">
                Start an agent or create a workspace to begin work.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Start Agent Button */}
          <button
            onClick={handleStartAgent}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            <Play className="w-5 h-5" />
            <span className="font-medium">Start Agent</span>
          </button>

          {/* Create Workspace Button */}
          <button
            onClick={handleCreateWorkspace}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors border border-gray-600"
          >
            <FolderPlus className="w-5 h-5" />
            <span className="font-medium">
              {copiedWorkspace ? 'Copied!' : 'Create Workspace Only'}
            </span>
          </button>
        </div>

        <div className="text-xs text-gray-500 mt-3 space-y-1">
          <p>
            <strong>Start Agent:</strong> Creates workspace + starts autonomous agent
          </p>
          <p>
            <strong>Create Workspace:</strong> Creates git worktree for manual work
          </p>
        </div>
      </div>
    </div>
  );
}
