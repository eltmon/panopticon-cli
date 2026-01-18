import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KanbanBoard } from './components/KanbanBoard';
import { AgentList } from './components/AgentList';
import { TerminalView } from './components/TerminalView';
import { HealthDashboard } from './components/HealthDashboard';
import { SkillsList } from './components/SkillsList';
import { Eye, LayoutGrid, Users, Activity, BookOpen, X } from 'lucide-react';
import { Agent } from './types';

type Tab = 'kanban' | 'agents' | 'skills' | 'health';

async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch('/api/agents');
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('kanban');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

  // Fetch agents to find if selected issue has an agent
  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    refetchInterval: 5000,
  });

  // Find agent for selected issue
  const selectedIssueAgent = selectedIssue
    ? agents.find((a) => a.issueId?.toLowerCase() === selectedIssue.toLowerCase())
    : null;

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold text-white">Panopticon</h1>
          </div>
          <nav className="flex gap-2">
            {([
              { id: 'kanban', label: 'Board', icon: LayoutGrid },
              { id: 'agents', label: 'Agents', icon: Users },
              { id: 'skills', label: 'Skills', icon: BookOpen },
              { id: 'health', label: 'Health', icon: Activity },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="p-6">
        {activeTab === 'kanban' && (
          <div className="flex gap-6">
            <div className={selectedIssueAgent ? 'flex-1' : 'w-full'}>
              <KanbanBoard
                selectedIssue={selectedIssue}
                onSelectIssue={setSelectedIssue}
              />
            </div>
            {selectedIssueAgent && (
              <div className="w-[500px] flex-shrink-0">
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {selectedIssue}
                      </span>
                      <span className="text-xs text-gray-400">
                        {selectedIssueAgent.model}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedIssue(null)}
                      className="text-gray-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <TerminalView agentId={selectedIssueAgent.id} />
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgentList
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
            />
            {selectedAgent && <TerminalView agentId={selectedAgent} />}
          </div>
        )}
        {activeTab === 'skills' && <SkillsList />}
        {activeTab === 'health' && <HealthDashboard />}
      </main>
    </div>
  );
}
