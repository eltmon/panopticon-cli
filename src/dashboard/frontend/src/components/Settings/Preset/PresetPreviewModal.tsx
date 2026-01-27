import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { ModelPreset, WorkTypeId, ModelId, WorkTypeCategory, WORK_TYPE_CATEGORIES } from '../types';
import { Button } from '../Shared/Button';

export interface PresetPreviewModalProps {
  preset: ModelPreset;
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  currentOverrides: Partial<Record<WorkTypeId, ModelId>>;
}

interface PresetModelInfo {
  model: string;
  provider: 'anthropic' | 'openai' | 'google' | 'zai';
  costTier: 1 | 2 | 3 | 4 | 5;
}

interface PresetData {
  preset: ModelPreset;
  displayName: string;
  description: string;
  costLevel: number;
  models: Record<WorkTypeId, PresetModelInfo>;
}

const categoryLabels: Record<WorkTypeCategory, string> = {
  'issue-agent': 'Issue Agent Phases',
  'specialist': 'Specialist Agents',
  'convoy': 'Convoy Members',
  'subagent': 'Subagents',
  'pre-work': 'Pre-Work Agents',
  'cli': 'CLI Contexts',
};

export function PresetPreviewModal({
  preset,
  isOpen,
  onClose,
  onApply,
  currentOverrides,
}: PresetPreviewModalProps) {
  const [presetData, setPresetData] = useState<PresetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && preset) {
      fetchPresetData();
    }
  }, [isOpen, preset]);

  const fetchPresetData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/settings/presets/${preset}`);
      if (!response.ok) {
        throw new Error('Failed to fetch preset data');
      }
      const data = await response.json();
      setPresetData(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const hasOverride = (workType: WorkTypeId): boolean => {
    return workType in currentOverrides;
  };

  const categories: WorkTypeCategory[] = ['issue-agent', 'specialist', 'convoy', 'subagent', 'pre-work', 'cli'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">
              {presetData?.displayName || preset} Preset Preview
            </h2>
            {presetData && (
              <p className="text-sm text-gray-400 mt-1">{presetData.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-md p-4 text-red-400">
              Error: {error}
            </div>
          )}

          {presetData && !loading && !error && (
            <div className="space-y-4">
              {/* Cost Level Indicator */}
              <div className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
                <span className="text-slate-300">Cost Level:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`w-3 h-6 rounded ${
                        level <= presetData.costLevel ? 'bg-yellow-500' : 'bg-slate-700'
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-sm text-slate-400">
                    ({presetData.costLevel}/5)
                  </span>
                </div>
              </div>

              {/* Model Assignments by Category */}
              {categories.map((category) => {
                const workTypes = WORK_TYPE_CATEGORIES[category];
                if (!workTypes || workTypes.length === 0) return null;

                return (
                  <div key={category} className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                      {categoryLabels[category]}
                    </h3>
                    <div className="space-y-1">
                      {workTypes.map((workType) => {
                        const modelInfo = presetData.models[workType.id];
                        const isOverridden = hasOverride(workType.id);

                        if (!modelInfo) return null;

                        return (
                          <div
                            key={workType.id}
                            className={`grid grid-cols-[40%_45%_15%] gap-3 px-3 py-2 rounded text-sm ${
                              isOverridden
                                ? 'bg-orange-900/20 border-l-2 border-orange-500'
                                : 'bg-slate-800/30'
                            }`}
                          >
                            <div className="text-white">{workType.displayName}</div>
                            <div className="text-slate-300 text-xs flex items-center gap-2">
                              {modelInfo.model}
                              <span className="text-xs text-slate-500">({modelInfo.provider})</span>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-yellow-400">
                                {'$'.repeat(modelInfo.costTier)}
                              </span>
                              {isOverridden && (
                                <span className="text-xs text-orange-400 font-medium">
                                  Will override
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Override Warning */}
              {Object.keys(currentOverrides).length > 0 && (
                <div className="bg-orange-900/30 border border-orange-700 rounded-md p-4 text-sm">
                  <span className="text-orange-400 font-semibold">⚠️ Note:</span>
                  <span className="text-orange-300 ml-2">
                    Applying this preset will preserve your {Object.keys(currentOverrides).length} existing
                    override{Object.keys(currentOverrides).length !== 1 ? 's' : ''}.
                    Overrides always take precedence over preset defaults.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onApply();
              onClose();
            }}
            disabled={loading || !!error}
          >
            Apply Preset
          </Button>
        </div>
      </div>
    </div>
  );
}
