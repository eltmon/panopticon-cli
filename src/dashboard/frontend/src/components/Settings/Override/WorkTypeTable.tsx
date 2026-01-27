import { WorkTypeId, WorkTypeCategory, WORK_TYPE_CATEGORIES, ModelId } from '../types';
import { Badge } from '../Shared/Badge';
import { Settings, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface WorkTypeTableProps {
  overrides: Partial<Record<WorkTypeId, ModelId>>;
  presetModels: Partial<Record<WorkTypeId, ModelId>>;
  onConfigureOverride: (workType: WorkTypeId) => void;
  onRemoveOverride: (workType: WorkTypeId) => void;
}

export function WorkTypeTable({ overrides, presetModels, onConfigureOverride, onRemoveOverride }: WorkTypeTableProps) {
  const categories: WorkTypeCategory[] = ['issue-agent', 'specialist', 'convoy', 'subagent', 'pre-work', 'cli'];

  const categoryLabels: Record<WorkTypeCategory, string> = {
    'issue-agent': 'Issue Agent Phases',
    'specialist': 'Specialist Agents',
    'convoy': 'Convoy Members',
    'subagent': 'Subagents',
    'pre-work': 'Pre-Work Agents',
    'cli': 'CLI Contexts',
  };

  const getEffectiveModel = (workType: WorkTypeId): ModelId => {
    return overrides[workType] || presetModels[workType] || 'claude-sonnet-4-5';
  };

  const hasOverride = (workType: WorkTypeId): boolean => {
    return workType in overrides;
  };

  return (
    <div className="space-y-1">
      {/* Table Header */}
      <div className="grid grid-cols-[30%_27%_27%_16%] gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#a390cb] border-b border-slate-700">
        <div>Work Type</div>
        <div>Preset Default</div>
        <div>Current Model</div>
        <div className="text-right">Actions</div>
      </div>

      {/* Table Body */}
      {categories.map((category) => (
        <div key={category}>
          {/* Category Header */}
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-800/50">
            {categoryLabels[category]}
          </div>

          {/* Work Type Rows */}
          {WORK_TYPE_CATEGORIES[category].map((workType, idx) => {
            const isOverridden = hasOverride(workType.id);
            const effectiveModel = getEffectiveModel(workType.id);
            const presetDefault = presetModels[workType.id] || 'claude-sonnet-4-5';

            return (
              <div
                key={workType.id}
                className={cn(
                  'grid grid-cols-[30%_27%_27%_16%] gap-3 px-4 py-3 text-sm hover:bg-slate-800/30 transition-colors',
                  idx % 2 === 0 ? 'bg-slate-800/10' : 'bg-transparent',
                  isOverridden && 'bg-blue-900/10 border-l-2 border-blue-500/50'
                )}
              >
                {/* Work Type Name */}
                <div className="text-white font-medium">{workType.displayName}</div>

                {/* Preset Default */}
                <div className="text-slate-400 truncate text-xs">
                  {presetDefault}
                </div>

                {/* Current Model with Badge */}
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'truncate text-xs',
                    isOverridden ? 'text-blue-300 font-medium' : 'text-[#a390cb]'
                  )}>
                    {effectiveModel}
                  </span>
                  {isOverridden && (
                    <Badge variant="override">override</Badge>
                  )}
                </div>

                {/* Override Actions */}
                <div className="flex items-center justify-end gap-2">
                  {isOverridden ? (
                    <button
                      onClick={() => onRemoveOverride(workType.id)}
                      className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 text-xs"
                      title="Remove override"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onConfigureOverride(workType.id)}
                      className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
                      title="Configure override"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Table Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 text-sm">
        <button className="text-slate-400 hover:text-white transition-colors">Reset all overrides to preset</button>
        <span className="text-slate-500">
          {Object.keys(overrides).length} override{Object.keys(overrides).length !== 1 ? 's' : ''} active
        </span>
      </div>
    </div>
  );
}
