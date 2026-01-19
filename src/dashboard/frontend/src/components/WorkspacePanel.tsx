import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  GitBranch,
  Folder,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  Square,
  Send,
  RefreshCw,
} from 'lucide-react';
import { Agent } from '../types';

// Clipboard helper that works without HTTPS
function copyToClipboard(text: string): boolean {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text);
    return true;
  }

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

interface WorkspacePanelProps {
  agent: Agent;
  issueUrl?: string;
  onClose: () => void;
}

async function fetchOutput(agentId: string): Promise<string> {
  const res = await fetch(`/api/agents/${agentId}/output?lines=200`);
  if (!res.ok) throw new Error('Failed to fetch output');
  const data = await res.json();
  return data.output || '';
}

export function WorkspacePanel({ agent, issueUrl, onClose }: WorkspacePanelProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'status'>('logs');
  const terminalRef = useRef<HTMLPreElement>(null);

  const tmuxCommand = `tmux attach -t ${agent.id}`;

  const { data: output, refetch } = useQuery({
    queryKey: ['agent-output', agent.id],
    queryFn: () => fetchOutput(agent.id),
    refetchInterval: 2000,
  });

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      const res = await fetch(`/api/agents/${agent.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error('Failed to send');
    },
    onSuccess: () => {
      setMessage('');
      setTimeout(() => refetch(), 500);
    },
  });

  const killMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to kill');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      onClose();
    },
  });

  const handleCopy = useCallback(() => {
    copyToClipboard(tmuxCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [tmuxCommand]);

  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (output) {
      scrollToBottom();
    }
  }, [output, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
    const timer1 = setTimeout(scrollToBottom, 50);
    const timer2 = setTimeout(scrollToBottom, 150);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [agent.id, scrollToBottom]);

  const handleSend = () => {
    if (message.trim()) {
      sendMutation.mutate(message.trim());
    }
  };

  const handleKill = () => {
    if (confirm(`Kill agent ${agent.id}?`)) {
      killMutation.mutate();
    }
  };

  // Format duration
  const startedAt = new Date(agent.startedAt);
  const durationMs = Date.now() - startedAt.getTime();
  const durationMins = Math.floor(durationMs / 60000);
  const durationHours = Math.floor(durationMins / 60);
  const duration = durationHours > 0
    ? `${durationHours}h ${durationMins % 60}m`
    : `${durationMins}m`;

  return (
    <div className="flex h-full bg-gray-800 border-l border-gray-700">
      {/* Left sidebar - Workspace info */}
      <div className="w-64 border-r border-gray-700 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="px-3 py-2 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-gray-400">Agent Running</span>
          </div>
          <h2 className="font-mono text-sm text-white font-medium mt-1">
            {agent.issueId}
          </h2>
        </div>

        {/* Agent info */}
        <div className="px-3 py-2 border-b border-gray-700 text-xs">
          <div className="text-gray-500 uppercase tracking-wider mb-2">Agent</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Model</span>
              <span className="text-white">{agent.model}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Runtime</span>
              <span className="text-white">{agent.runtime}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Uptime</span>
              <span className="text-white">{duration}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Session</span>
              <span className="text-white font-mono text-[10px]">{agent.id}</span>
            </div>
          </div>
        </div>

        {/* Git Status */}
        {agent.git && (
          <div className="px-3 py-2 border-b border-gray-700 text-xs">
            <div className="text-gray-500 uppercase tracking-wider mb-2">Git Status</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-white">
                <GitBranch className="w-3 h-3" />
                <span className="font-mono">{agent.git.branch}</span>
              </div>
              {agent.git.uncommittedFiles > 0 && (
                <div className="text-yellow-400 text-[10px] ml-4">
                  {agent.git.uncommittedFiles} uncommitted files
                </div>
              )}
              <div className="text-gray-400 text-[10px] mt-1 truncate" title={agent.git.latestCommit}>
                {agent.git.latestCommit}
              </div>
            </div>
          </div>
        )}

        {/* Workspace path */}
        {agent.workspace && (
          <div className="px-3 py-2 border-b border-gray-700 text-xs">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Folder className="w-3 h-3" />
              <span className="font-mono truncate text-[10px]" title={agent.workspace}>
                {agent.workspace}
              </span>
            </div>
          </div>
        )}

        {/* Links */}
        <div className="px-3 py-2 border-b border-gray-700 text-xs">
          <div className="text-gray-500 uppercase tracking-wider mb-2">Links</div>
          <div className="space-y-1.5">
            {issueUrl && (
              <a
                href={issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Linear Issue</span>
              </a>
            )}
          </div>
        </div>

        {/* Tmux attach command */}
        <div className="px-3 py-2 border-b border-gray-700 text-xs">
          <div className="text-gray-500 uppercase tracking-wider mb-2">Attach Command</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 bg-gray-900 rounded font-mono text-[11px] text-gray-300 overflow-hidden">
              <Terminal className="w-3 h-3 shrink-0 text-blue-400" />
              <span className="truncate">{tmuxCommand}</span>
            </div>
            <button
              onClick={handleCopy}
              className={`p-1.5 rounded transition-colors ${
                copied
                  ? 'bg-green-900/30 text-green-400'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white'
              }`}
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="px-3 py-2 border-b border-gray-700">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Actions</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={handleKill}
              disabled={killMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
            >
              <Square className="w-3 h-3" />
              Stop Agent
            </button>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* Right side - Logs */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Tabs header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                activeTab === 'logs'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Logs
            </button>
            <button
              onClick={() => setActiveTab('status')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                activeTab === 'status'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Status
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => refetch()}
              className="p-1 text-gray-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'logs' ? (
          <>
            <pre
              ref={terminalRef}
              className="flex-1 min-h-0 overflow-auto p-3 bg-gray-900 text-gray-200 font-mono text-xs leading-relaxed m-0 whitespace-pre"
            >
              {output || 'Connecting to agent...'}
            </pre>

            {/* Input */}
            <div className="p-2 border-t border-gray-700 bg-gray-800">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Send message to agent..."
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sendMutation.isPending}
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-gray-900">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-white mb-2">Agent Summary</h3>
                <div className="text-xs text-gray-300 space-y-1">
                  <p><strong>Issue:</strong> {agent.issueId}</p>
                  <p><strong>Session:</strong> <span className="font-mono text-[10px]">{agent.id}</span></p>
                  <p><strong>Model:</strong> {agent.model}</p>
                  <p><strong>Runtime:</strong> {agent.runtime}</p>
                  <p><strong>Started:</strong> {startedAt.toLocaleString()}</p>
                  <p><strong>Uptime:</strong> {duration}</p>
                </div>
              </div>

              {agent.workspace && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-2">Workspace</h3>
                  <div className="text-xs text-gray-300 space-y-1">
                    <p className="font-mono text-[10px] break-all">{agent.workspace}</p>
                  </div>
                </div>
              )}

              {agent.git && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-2">Git Status</h3>
                  <div className="text-xs text-gray-300 space-y-1">
                    <p><strong>Branch:</strong> <span className="font-mono">{agent.git.branch}</span></p>
                    <p><strong>Uncommitted:</strong> {agent.git.uncommittedFiles} files</p>
                    <p><strong>Latest:</strong> {agent.git.latestCommit}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-white mb-2">Health</h3>
                <div className="text-xs text-gray-300 space-y-1">
                  <p><strong>Status:</strong> <span className="text-green-400">{agent.status}</span></p>
                  <p><strong>Consecutive Failures:</strong> {agent.consecutiveFailures}</p>
                  <p><strong>Total Restarts:</strong> {agent.killCount}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
