import { useState } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { AgentList } from './components/AgentList';
import { TerminalView } from './components/TerminalView';
import { HealthDashboard } from './components/HealthDashboard';
import { SkillsList } from './components/SkillsList';
import { Eye, LayoutGrid, Users, Activity, BookOpen } from 'lucide-react';

type Tab = 'kanban' | 'agents' | 'skills' | 'health';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('kanban');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

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
        {activeTab === 'kanban' && <KanbanBoard />}
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
