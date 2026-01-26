import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { WorkTypeId, ModelId, WORK_TYPE_CATEGORIES } from '../types';
import { Button } from '../Shared/Button';
import { ModelSelector, AvailableModels } from './ModelSelector';

export interface OverrideConfigModalProps {
  workType: WorkTypeId | null;
  currentModel?: ModelId;
  presetModel?: ModelId;
  availableModels: AvailableModels;
  isOpen: boolean;
  onClose: () => void;
  onApply: (workType: WorkTypeId, model: ModelId) => void;
}

function getModelCostTier(model: string): 1 | 2 | 3 | 4 | 5 {
  const lowerModel = model.toLowerCase();

  // Tier 5: Most expensive (Opus, GPT-5.2, O3)
  if (lowerModel.includes('opus') || lowerModel.includes('gpt-5') || lowerModel.includes('o3-')) {
    return 5;
  }

  // Tier 4: Premium (Sonnet, GPT-4o, Gemini Pro)
  if (lowerModel.includes('sonnet') || lowerModel.includes('gpt-4o') || lowerModel.includes('gemini-3-pro')) {
    return 4;
  }

  // Tier 3: Mid-tier (GPT-4o-mini, GLM-4)
  if (lowerModel.includes('gpt-4o-mini') || lowerModel.includes('glm-4')) {
    return 3;
  }

  // Tier 2: Budget (Haiku-like models)
  if (lowerModel.includes('haiku')) {
    return 2;
  }

  // Tier 1: Cheapest (Flash models)
  if (lowerModel.includes('flash')) {
    return 1;
  }

  return 3; // Default
}

function getCostTierLabel(tier: number): string {
  const labels = {
    1: '$',
    2: '$$',
    3: '$$$',
    4: '$$$$',
    5: '$$$$$',
  };
  return labels[tier as keyof typeof labels] || '$$$';
}

function getWorkTypeName(workTypeId: WorkTypeId): string {
  for (const category of Object.values(WORK_TYPE_CATEGORIES)) {
    const workType = category.find((wt) => wt.id === workTypeId);
    if (workType) return workType.displayName;
  }
  return workTypeId;
}

export function OverrideConfigModal({
  workType,
  currentModel,
  presetModel,
  availableModels,
  isOpen,
  onClose,
  onApply,
}: OverrideConfigModalProps) {
  const [selectedModel, setSelectedModel] = useState<ModelId>(currentModel || presetModel || 'claude-sonnet-4-5');

  // Update selected model when modal opens with new work type
  useEffect(() => {
    if (isOpen && workType) {
      setSelectedModel(currentModel || presetModel || 'claude-sonnet-4-5');
    }
  }, [isOpen, workType, currentModel, presetModel]);

  if (!isOpen || !workType) return null;

  const workTypeName = getWorkTypeName(workType);
  const defaultModel = presetModel || 'claude-sonnet-4-5';
  const selectedCostTier = getModelCostTier(selectedModel);
  const defaultCostTier = getModelCostTier(defaultModel);
  const costDifference = selectedCostTier - defaultCostTier;

  const handleApply = () => {
    if (workType) {
      onApply(workType, selectedModel);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">Configure Override</h2>
            <p className="text-sm text-gray-400 mt-1">{workTypeName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Preset Default Info */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Preset Default:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{defaultModel}</span>
                <span className="text-xs text-yellow-400">{getCostTierLabel(defaultCostTier)}</span>
              </div>
            </div>
          </div>

          {/* Model Selector */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">Override Model:</label>
            <ModelSelector value={selectedModel} onChange={setSelectedModel} availableModels={availableModels} />
          </div>

          {/* Cost Comparison */}
          {costDifference !== 0 && (
            <div
              className={`rounded-lg p-4 text-sm ${
                costDifference > 0
                  ? 'bg-orange-900/30 border border-orange-700'
                  : 'bg-green-900/30 border border-green-700'
              }`}
            >
              <span className={costDifference > 0 ? 'text-orange-400' : 'text-green-400'}>
                {costDifference > 0 ? '⚠️ Cost Impact:' : '✅ Cost Savings:'}
              </span>
              <span className={costDifference > 0 ? 'text-orange-300 ml-2' : 'text-green-300 ml-2'}>
                {costDifference > 0
                  ? `This model is ${Math.abs(costDifference)} tier${Math.abs(costDifference) !== 1 ? 's' : ''} more expensive than the preset default.`
                  : `This model is ${Math.abs(costDifference)} tier${Math.abs(costDifference) !== 1 ? 's' : ''} cheaper than the preset default.`}
              </span>
            </div>
          )}

          {/* Same as preset notice */}
          {selectedModel === defaultModel && (
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 text-sm">
              <span className="text-blue-400 font-semibold">ℹ️ Note:</span>
              <span className="text-blue-300 ml-2">
                This model matches the preset default. You don't need an override for this work type.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Apply Override
          </Button>
        </div>
      </div>
    </div>
  );
}
