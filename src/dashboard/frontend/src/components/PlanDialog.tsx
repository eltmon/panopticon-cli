import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Loader2, CheckCircle2, AlertCircle, Sparkles, Play, MessageCircle, Terminal, Send, Square, Upload, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Issue } from '../types';

interface PlanDialogProps {
  issue: Issue;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface StartPlanningResult {
  success: boolean;
  issue: {
    id: string;
    identifier: string;
    title: string;
    newState: string;
  };
  workspace: {
    created: boolean;
    path: string;
    error?: string;
  };
  planningAgent: {
    started: boolean;
    sessionName?: string;
    error?: string;
  };
}

interface PlanningStatus {
  active: boolean;
  sessionName: string;
  recentOutput?: string;
  error?: string;
}

type Step = 'ready' | 'syncing' | 'starting' | 'planning' | 'viewing' | 'complete' | 'error';

export function PlanDialog({ issue, isOpen, onClose, onComplete }: PlanDialogProps) {
  const [step, setStep] = useState<Step>('ready');
  const [result, setResult] = useState<StartPlanningResult | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Start planning mutation
  const startPlanningMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/issues/${issue.identifier}/start-planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start planning');
      }
      return res.json() as Promise<StartPlanningResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.planningAgent.started) {
        setStep('planning');
      } else if (data.planningAgent.error) {
        setError(data.planningAgent.error);
        setStep('error');
      }
    },
    onError: (err: Error) => {
      setError(err.message);
      setStep('error');
    },
  });

  // Poll for planning status (active session) or fetch once (viewing completed)
  const statusQuery = useQuery({
    queryKey: ['planningStatus', issue.identifier],
    queryFn: async () => {
      const res = await fetch(`/api/planning/${issue.identifier}/status`);
      if (!res.ok) throw new Error('Failed to get status');
      return res.json() as Promise<PlanningStatus>;
    },
    enabled: step === 'planning' || step === 'viewing',
    refetchInterval: step === 'planning' ? 2000 : false, // Only poll during active session
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (msg: string) => {
      const res = await fetch(`/api/planning/${issue.identifier}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      setMessage('');
    },
  });

  // Stop planning mutation (keeps state as "In Planning")
  const stopPlanningMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/planning/${issue.identifier}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to stop planning');
      return res.json();
    },
    onSuccess: () => {
      setStep('complete');
    },
  });

  // Continue planning mutation (continues with user response)
  const continuePlanningMutation = useMutation({
    mutationFn: async (userResponse: string) => {
      const res = await fetch(`/api/issues/${issue.identifier}/continue-planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: userResponse }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to continue planning');
      }
      return res.json();
    },
    onSuccess: () => {
      setMessage('');
      setStep('planning'); // Switch back to active planning view
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Abort planning mutation (reverts state to Todo)
  const abortPlanningMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/issues/${issue.identifier}/abort-planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteWorkspace: false }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to abort planning');
      }
      return res.json();
    },
    onSuccess: () => {
      onComplete(); // Refresh the issue list
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Complete planning - mark as ready for execution
  const completePlanningMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/issues/${issue.identifier}/complete-planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to complete planning');
      }
      return res.json();
    },
    onSuccess: () => {
      onComplete(); // Refresh the issue list
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Push planning to remote
  const pushPlanningMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/issues/${issue.identifier}/push-planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to push planning');
      }
      return res.json();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Sync planning from remote
  const syncPlanningMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/issues/${issue.identifier}/sync-planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sync planning');
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.action === 'pulled' || data.action === 'created') {
        // Refresh status to show new planning data
        statusQuery.refetch();
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Scroll to bottom of output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [statusQuery.data?.recentOutput]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep('ready');
      setResult(null);
      setMessage('');
      setError(null);
    }
  }, [isOpen]);

  // Check if planning session already exists when dialog opens
  // Also sync from remote in case someone else pushed updates
  useEffect(() => {
    if (isOpen && step === 'ready') {
      // Show syncing state while we check
      setStep('syncing');

      // First sync from remote to get any updates
      fetch(`/api/issues/${issue.identifier}/sync-planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
        .then(res => res.json())
        .then((syncData) => {
          // Then check planning status
          return fetch(`/api/planning/${issue.identifier}/status`)
            .then(res => res.json())
            .then((data: PlanningStatus) => {
              if (data.active) {
                // Session is running
                setStep('planning');
              } else if (data.recentOutput && ['Planned', 'Ready'].includes(issue.status)) {
                // Session ended with output AND issue is in a "completed planning" state
                // Show the viewing step so they can review the plan
                setStep('viewing');
              } else {
                // All other cases: go to ready which shows appropriate start/resume options
                // - "In Planning" -> shows Resume/Abort
                // - "In Progress" -> shows Start Planning (re-plan from scratch)
                // - "Todo" -> shows Start Planning
                setStep('ready');
              }
              // Show sync result if something was pulled
              if (syncData.action === 'pulled') {
                console.log(`Synced: ${syncData.message}`);
              } else if (syncData.action === 'created') {
                console.log(`Created workspace from remote: ${syncData.message}`);
              }
            });
        })
        .catch(() => {
          // On error, go back to ready
          setStep('ready');
        });
    }
  }, [isOpen, issue.identifier]);

  const handleStartPlanning = () => {
    setStep('starting');
    startPlanningMutation.mutate();
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const handleStopPlanning = () => {
    stopPlanningMutation.mutate();
  };

  const handleAbortPlanning = () => {
    const confirmed = confirm(
      'Abort planning and return to Todo?\n\n' +
      'This will:\n' +
      '• Stop the planning agent\n' +
      '• Move the issue back to "Todo"\n' +
      '• Keep the workspace (can be deleted separately)\n\n' +
      'Any planning artifacts in the workspace will be preserved.'
    );
    if (confirmed) {
      abortPlanningMutation.mutate();
    }
  };

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 min-h-[70vh] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Plan: {issue.identifier}</h2>
              <p className="text-sm text-gray-400 line-clamp-1">{issue.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === 'planning' && (
              <>
                <span className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                  Planning Active
                </span>
                <button
                  onClick={handleStopPlanning}
                  disabled={stopPlanningMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  title="Stop the planning agent"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Ready step - start planning */}
          {step === 'ready' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center mb-6">
                <Terminal className="w-10 h-10 text-purple-400" />
              </div>
              {/* Check if already in planning state */}
              {['In Planning', 'Planning', 'Planned', 'Discovery'].includes(issue.status) ? (
                <>
                  <h3 className="text-xl font-semibold text-white mb-2">Resume Planning Session</h3>
                  <p className="text-gray-400 text-center max-w-md mb-6">
                    This issue is in <span className="text-purple-400 font-medium">"In Planning"</span> state.
                    You can resume planning or abort to return to Todo.
                  </p>

                  <div className="bg-gray-700/50 rounded-lg p-4 mb-6 max-w-md w-full">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Options:</h4>
                    <ul className="space-y-2 text-sm text-gray-400">
                      <li className="flex items-center gap-2">
                        <Play className="w-4 h-4 text-purple-400" />
                        <span><strong className="text-purple-400">Resume</strong> - Start a new planning agent session</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <X className="w-4 h-4 text-orange-400" />
                        <span><strong className="text-orange-400">Abort</strong> - Return issue to Todo (keeps workspace)</span>
                      </li>
                    </ul>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleAbortPlanning}
                      disabled={abortPlanningMutation.isPending}
                      className="flex items-center gap-2 px-5 py-3 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-lg transition-colors font-medium disabled:opacity-50"
                    >
                      <X className="w-5 h-5" />
                      {abortPlanningMutation.isPending ? 'Aborting...' : 'Abort Planning'}
                    </button>
                    <button
                      onClick={handleStartPlanning}
                      className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors font-medium"
                    >
                      <Play className="w-5 h-5" />
                      Resume Planning
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-semibold text-white mb-2">Start Planning Session</h3>
                  <p className="text-gray-400 text-center max-w-md mb-6">
                    This will move the issue to <span className="text-purple-400 font-medium">"In Planning"</span>,
                    create a workspace, and start an AI discovery session to help define the implementation plan.
                  </p>

                  <div className="bg-gray-700/50 rounded-lg p-4 mb-6 max-w-md w-full">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">What happens:</h4>
                    <ul className="space-y-2 text-sm text-gray-400">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        Issue moves to "In Planning" in Linear
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        Git worktree created for feature branch
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        Opus agent starts discovery conversation
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={handleStartPlanning}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors font-medium"
                  >
                    <Play className="w-5 h-5" />
                    Start Planning
                  </button>
                </>
              )}
            </div>
          )}

          {/* Starting step */}
          {step === 'starting' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
              <p className="text-gray-300">Starting planning session...</p>
              <p className="text-sm text-gray-500 mt-2">Moving to In Planning, creating workspace, spawning agent</p>
            </div>
          )}

          {/* Syncing step - checking for remote updates and existing session */}
          {step === 'syncing' && (
            <div className="flex-1 flex flex-col p-8">
              {/* Skeleton header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gray-700 animate-pulse" />
                <div className="flex-1 space-y-3">
                  <div className="h-6 bg-gray-700 rounded animate-pulse w-48" />
                  <div className="h-4 bg-gray-700 rounded animate-pulse w-64" />
                </div>
              </div>

              {/* Skeleton content area */}
              <div className="flex-1 space-y-4">
                <div className="h-4 bg-gray-700 rounded animate-pulse w-full" />
                <div className="h-4 bg-gray-700 rounded animate-pulse w-5/6" />
                <div className="h-4 bg-gray-700 rounded animate-pulse w-4/5" />
                <div className="h-4 bg-gray-700 rounded animate-pulse w-full" />
                <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4" />
              </div>

              {/* Loading indicator */}
              <div className="flex items-center justify-center gap-2 mt-6 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Checking for existing session...</span>
              </div>
            </div>
          )}

          {/* Planning step - active session */}
          {step === 'planning' && (
            <>
              {/* Terminal output */}
              <div
                ref={outputRef}
                className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-gray-900"
              >
                {statusQuery.data?.recentOutput ? (
                  <div className="prose prose-invert prose-sm max-w-none text-gray-300
                    prose-headings:text-purple-300 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
                    prose-h2:text-lg prose-h3:text-base
                    prose-strong:text-white prose-strong:font-semibold
                    prose-ul:my-2 prose-li:my-0.5
                    prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-purple-300
                    prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-700">
                    <ReactMarkdown>
                      {statusQuery.data.recentOutput}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Waiting for agent output...
                  </div>
                )}
              </div>

              {/* Message input */}
              <div className="border-t border-gray-700 p-4">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message to the planning agent..."
                    className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!message.trim() || sendMessageMutation.isPending}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MessageCircle className="w-4 h-4" />
                    Chat with the planning agent
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAbortPlanning}
                      disabled={abortPlanningMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 text-sm rounded transition-colors disabled:opacity-50"
                      title="Stop planning and return to Todo"
                    >
                      <X className="w-4 h-4" />
                      Abort
                    </button>
                    <button
                      onClick={handleStopPlanning}
                      disabled={stopPlanningMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded transition-colors disabled:opacity-50"
                      title="Stop agent but keep In Planning state"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Viewing step - session ended but has output */}
          {step === 'viewing' && (
            <>
              {/* Header */}
              <div className="px-4 py-2 bg-blue-900/30 border-b border-blue-700/50 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-300">Planning session completed</span>
              </div>

              {/* Output */}
              <div
                ref={outputRef}
                className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-gray-900"
              >
                {statusQuery.data?.recentOutput ? (
                  <div className="prose prose-invert prose-sm max-w-none text-gray-300
                    prose-headings:text-purple-300 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
                    prose-h2:text-lg prose-h3:text-base
                    prose-strong:text-white prose-strong:font-semibold
                    prose-ul:my-2 prose-li:my-0.5
                    prose-code:bg-gray-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-purple-300
                    prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-700">
                    <ReactMarkdown>
                      {statusQuery.data.recentOutput}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-gray-500">No output available</div>
                )}
              </div>

              {/* Response input */}
              <div className="border-t border-gray-700 p-4">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (message.trim()) {
                    continuePlanningMutation.mutate(message.trim());
                  }
                }} className="space-y-3">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (message.trim() && !continuePlanningMutation.isPending) {
                          continuePlanningMutation.mutate(message.trim());
                        }
                      }
                    }}
                    placeholder="Type your response to continue the planning conversation... (Enter to send, Shift+Enter for newline)"
                    rows={3}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={!message.trim() || continuePlanningMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      >
                        {continuePlanningMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Continue Planning
                      </button>
                      <button
                        type="button"
                        onClick={() => completePlanningMutation.mutate()}
                        disabled={completePlanningMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                        title="Mark planning complete - ready for execution"
                      >
                        {completePlanningMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Done
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => syncPlanningMutation.mutate()}
                        disabled={syncPlanningMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-sm rounded transition-colors disabled:opacity-50"
                        title="Pull planning from remote"
                      >
                        {syncPlanningMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Pull
                      </button>
                      <button
                        type="button"
                        onClick={() => pushPlanningMutation.mutate()}
                        disabled={pushPlanningMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm rounded transition-colors disabled:opacity-50"
                        title="Push planning to remote"
                      >
                        {pushPlanningMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        Push
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </>
          )}

          {/* Complete step */}
          {step === 'complete' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Planning Complete</h3>
              <p className="text-gray-400 text-center max-w-md mb-6">
                The planning session has ended. The issue is now ready for execution.
              </p>

              {result && (
                <div className="bg-gray-700/50 rounded-lg p-4 mb-6 max-w-md w-full">
                  <p className="text-sm text-gray-400 mb-2">Summary:</p>
                  <ul className="space-y-1 text-sm">
                    <li className="text-gray-300">
                      <span className="text-gray-500">Issue:</span> {result.issue.identifier}
                    </li>
                    <li className="text-gray-300">
                      <span className="text-gray-500">State:</span>{' '}
                      <span className="text-purple-400">{result.issue.newState}</span>
                    </li>
                    {result.workspace.created && (
                      <li className="text-gray-300">
                        <span className="text-gray-500">Workspace:</span>{' '}
                        <span className="text-blue-400 font-mono text-xs">{result.workspace.path}</span>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleComplete}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  <Play className="w-5 h-5" />
                  Start Agent
                </button>
              </div>
            </div>
          )}

          {/* Error step */}
          {step === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Planning Failed</h3>
              <p className="text-red-400 text-center max-w-md mb-6">{error}</p>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setStep('ready');
                    setError(null);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
