import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentHealth } from '../types';
import { Activity, AlertTriangle, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import { useState } from 'react';

async function fetchHealth(): Promise<AgentHealth[]> {
  const res = await fetch('/api/health/agents');
  if (!res.ok) throw new Error('Failed to fetch health');
  return res.json();
}

const STATUS_CONFIG: Record<AgentHealth['status'], { icon: typeof CheckCircle; color: string; bg: string }> = {
  healthy: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-900/30' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  stuck: { icon: Clock, color: 'text-orange-400', bg: 'bg-orange-900/30' },
  dead: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-900/30' },
};

export function HealthDashboard() {
  const queryClient = useQueryClient();
  const { data: health, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 5000,
  });

  // Cleanup state (PAN-85)
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<string[]>([]);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Fetch cleanup preview (dry run)
  const fetchCleanupPreview = async () => {
    try {
      const res = await fetch('/api/agents/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      if (!res.ok) throw new Error('Failed to fetch cleanup preview');
      const result = await res.json();
      setCleanupPreview(result.deleted || []);
      setShowCleanupDialog(true);
    } catch (err) {
      console.error('Error fetching cleanup preview:', err);
      alert('Failed to fetch cleanup preview');
    }
  };

  // Execute cleanup
  const executeCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const res = await fetch('/api/agents/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      if (!res.ok) throw new Error('Failed to clean up agents');
      const result = await res.json();

      // Refresh health data after cleanup
      await queryClient.invalidateQueries({ queryKey: ['health'] });

      setShowCleanupDialog(false);
      alert(`Successfully cleaned up ${result.count} agent directories`);
    } catch (err) {
      console.error('Error cleaning up agents:', err);
      alert('Failed to clean up agents: ' + (err as Error).message);
    } finally {
      setIsCleaningUp(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading health data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Error: {(error as Error).message}</div>
      </div>
    );
  }

  if (!health || health.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-400">No agents to monitor</h3>
        <p className="text-sm text-gray-500 mt-2">
          Health data will appear here when agents are running
        </p>
      </div>
    );
  }

  // Summary counts
  const counts = health.reduce(
    (acc, h) => {
      acc[h.status] = (acc[h.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {(['healthy', 'warning', 'stuck', 'dead'] as const).map((status) => {
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          return (
            <div
              key={status}
              className={`${config.bg} rounded-lg p-4 border border-gray-700`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-8 h-8 ${config.color}`} />
                <div>
                  <div className="text-2xl font-bold text-white">{counts[status] || 0}</div>
                  <div className="text-sm text-gray-400 capitalize">{status}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cleanup button (PAN-85) */}
      <div className="flex justify-end">
        <button
          onClick={fetchCleanupPreview}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clean Old Agents (7+ days)
        </button>
      </div>

      {/* Cleanup confirmation dialog (PAN-85) */}
      {showCleanupDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Agent Cleanup</h3>

            {cleanupPreview.length === 0 ? (
              <p className="text-gray-400 mb-6">No old agents to clean up.</p>
            ) : (
              <>
                <p className="text-gray-400 mb-4">
                  The following {cleanupPreview.length} agent directories will be deleted:
                </p>
                <div className="bg-gray-900 rounded p-4 mb-6 max-h-64 overflow-y-auto">
                  <ul className="text-sm text-gray-300 space-y-1">
                    {cleanupPreview.map((agent) => (
                      <li key={agent} className="font-mono">
                        {agent}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCleanupDialog(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                disabled={isCleaningUp}
              >
                Cancel
              </button>
              {cleanupPreview.length > 0 && (
                <button
                  onClick={executeCleanup}
                  disabled={isCleaningUp}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
                >
                  {isCleaningUp ? 'Cleaning...' : `Delete ${cleanupPreview.length} Agents`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {health.map((agent) => {
          const config = STATUS_CONFIG[agent.status];
          const Icon = config.icon;
          return (
            <div
              key={agent.agentId}
              className={`${config.bg} rounded-lg p-4 border border-gray-700`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-white">{agent.agentId}</div>
                  <div className={`flex items-center gap-1 text-sm ${config.color} mt-1`}>
                    <Icon className="w-4 h-4" />
                    <span className="capitalize">{agent.status}</span>
                  </div>
                </div>
              </div>

              {agent.reason && (
                <div className="mt-2 text-sm text-gray-400 italic">
                  {agent.reason}
                </div>
              )}

              <div className="mt-4 space-y-2 text-sm">
                {agent.lastPing && (
                  <div className="flex justify-between text-gray-400">
                    <span>Last ping:</span>
                    <span>{new Date(agent.lastPing).toLocaleTimeString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <span>Failures:</span>
                  <span className={agent.consecutiveFailures > 0 ? 'text-orange-400' : ''}>
                    {agent.consecutiveFailures}
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Kill count:</span>
                  <span className={agent.killCount > 0 ? 'text-red-400' : ''}>
                    {agent.killCount}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
