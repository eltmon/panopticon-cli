import { ModelId } from '../types';

export interface AvailableModels {
  anthropic: string[];
  openai: string[];
  google: string[];
  zai: string[];
}

export interface ModelSelectorProps {
  value: ModelId;
  onChange: (model: ModelId) => void;
  availableModels: AvailableModels;
}

const providerLabels: Record<keyof AvailableModels, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  zai: 'Zai',
};

const providerIcons: Record<keyof AvailableModels, string> = {
  anthropic: '🔮',
  openai: '🤖',
  google: '🔍',
  zai: '⚡',
};

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

export function ModelSelector({ value, onChange, availableModels }: ModelSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value as ModelId);
  };

  const providers = Object.keys(availableModels) as Array<keyof AvailableModels>;
  const hasModels = providers.some(p => availableModels[p].length > 0);

  if (!hasModels) {
    return (
      <div className="text-slate-400 text-sm py-2">
        No models available. Please configure API keys first.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={handleChange}
        className="w-full bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {providers.map((provider) => {
          const models = availableModels[provider];
          if (models.length === 0) return null;

          return (
            <optgroup key={provider} label={`${providerIcons[provider]} ${providerLabels[provider]}`}>
              {models.map((model) => {
                const costTier = getModelCostTier(model);
                const costLabel = getCostTierLabel(costTier);
                return (
                  <option key={model} value={model}>
                    {model} {costLabel}
                  </option>
                );
              })}
            </optgroup>
          );
        })}
      </select>

      {/* Model details */}
      {value && (
        <div className="flex items-center gap-3 text-xs text-slate-400 px-1">
          <span className="flex items-center gap-1">
            <span className="font-semibold">Cost:</span>
            <span className="text-yellow-400">{getCostTierLabel(getModelCostTier(value))}</span>
          </span>
        </div>
      )}
    </div>
  );
}
