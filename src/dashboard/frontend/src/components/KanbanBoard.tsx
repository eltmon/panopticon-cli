import { useQuery } from '@tanstack/react-query';
import { Issue, STATUS_ORDER, STATUS_LABELS } from '../types';
import { ExternalLink, User, Tag } from 'lucide-react';

async function fetchIssues(): Promise<Issue[]> {
  const res = await fetch('/api/issues');
  if (!res.ok) throw new Error('Failed to fetch issues');
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

export function KanbanBoard() {
  const { data: issues, isLoading, error } = useQuery({
    queryKey: ['issues'],
    queryFn: fetchIssues,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading issues...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Error loading issues: {(error as Error).message}</div>
      </div>
    );
  }

  const grouped = groupByStatus(issues || []);

  return (
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
              {grouped[status].map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
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
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const priorityColors: Record<number, string> = {
    0: 'border-l-gray-500',
    1: 'border-l-red-500',
    2: 'border-l-orange-500',
    3: 'border-l-yellow-500',
    4: 'border-l-blue-500',
  };

  return (
    <div
      className={`bg-gray-700 rounded-lg p-3 border-l-4 ${priorityColors[issue.priority] || 'border-l-gray-500'} hover:bg-gray-650 transition-colors`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-white hover:text-blue-400 flex items-center gap-1"
          >
            <span className="text-gray-400">{issue.identifier}</span>
            <ExternalLink className="w-3 h-3 opacity-50" />
          </a>
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
    </div>
  );
}
