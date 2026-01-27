import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { SettingsConfig, Provider, ModelPreset, WorkTypeId, ModelId } from './types';
import { PresetSelector } from './Preset/PresetSelector';
import { ProviderPanel } from './Provider/ProviderPanel';
import { WorkTypeOverrides } from './Override/WorkTypeOverrides';
import { OverrideConfigModal } from './Override/OverrideConfigModal';
import { PresetPreviewModal } from './Preset/PresetPreviewModal';
import { AvailableModels } from './Override/ModelSelector';
import { Button } from './Shared/Button';

// API Functions
async function fetchSettings(): Promise<SettingsConfig> {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

async function saveSettings(settings: SettingsConfig): Promise<void> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || 'Failed to save settings');
  }
}

async function validateApiKey(provider: Provider, apiKey: string): Promise<{ valid: boolean; models?: string[] }> {
  const res = await fetch('/api/settings/validate-api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, api_key: apiKey }),
  });
  if (!res.ok) throw new Error('Validation failed');
  return res.json();
}

async function fetchPresetModels(preset: ModelPreset): Promise<Record<WorkTypeId, ModelId>> {
  const res = await fetch(`/api/settings/presets/${preset}`);
  if (!res.ok) throw new Error('Failed to fetch preset models');
  const data = await res.json();
  // Extract just the model IDs from the response
  const models: Record<string, string> = {};
  for (const [workType, modelInfo] of Object.entries(data.models)) {
    models[workType] = (modelInfo as any).model;
  }
  return models as Record<WorkTypeId, ModelId>;
}

async function fetchAvailableModels(): Promise<AvailableModels> {
  const res = await fetch('/api/settings/available-models');
  if (!res.ok) throw new Error('Failed to fetch available models');
  return res.json();
}

export function SettingsPage() {
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  // Form state
  const [formData, setFormData] = useState<SettingsConfig | null>(null);

  // Override modal state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedWorkType, setSelectedWorkType] = useState<WorkTypeId | null>(null);

  // Preset preview modal state
  const [presetPreviewOpen, setPresetPreviewOpen] = useState(false);
  const [previewPreset, setPreviewPreset] = useState<ModelPreset | null>(null);

  // Fetch preset models based on current preset selection
  const { data: presetModels } = useQuery({
    queryKey: ['presetModels', formData?.models.preset || 'balanced'],
    queryFn: () => fetchPresetModels(formData?.models.preset || 'balanced'),
    enabled: !!formData,
  });

  // Fetch available models
  const { data: availableModels } = useQuery({
    queryKey: ['availableModels'],
    queryFn: fetchAvailableModels,
  });

  // Initialize form data when settings load
  useEffect(() => {
    if (settings && !formData) {
      setFormData(settings);
    }
  }, [settings, formData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">Error: {(error as Error).message}</div>
      </div>
    );
  }

  if (!formData) {
    return null;
  }

  // Check if form has changes
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(settings);

  // Handlers
  const handlePresetChange = (preset: ModelPreset) => {
    setFormData({
      ...formData,
      models: {
        ...formData.models,
        preset,
      },
    });
  };

  const handlePresetPreview = (preset: ModelPreset) => {
    setPreviewPreset(preset);
    setPresetPreviewOpen(true);
  };

  const handleApplyPreset = () => {
    if (previewPreset) {
      handlePresetChange(previewPreset);
    }
  };

  const handleProviderToggle = (provider: Provider) => {
    if (provider === 'anthropic') return; // Anthropic is always enabled

    setFormData({
      ...formData,
      models: {
        ...formData.models,
        providers: {
          ...formData.models.providers,
          [provider]: !formData.models.providers[provider],
        },
      },
    });
  };

  const handleApiKeyChange = (provider: Provider, key: string) => {
    if (provider === 'anthropic') return; // Anthropic key is from environment

    setFormData({
      ...formData,
      api_keys: {
        ...formData.api_keys,
        [provider]: key || undefined,
      },
    });
  };

  const handleThinkingLevelChange = (level: number) => {
    setFormData({
      ...formData,
      models: {
        ...formData.models,
        gemini_thinking_level: level,
      },
    });
  };

  const handleTestConnection = async (provider: Provider) => {
    const apiKey = formData.api_keys[provider as keyof typeof formData.api_keys];
    if (!apiKey) throw new Error('No API key provided');

    const result = await validateApiKey(provider, apiKey);
    if (!result.valid) {
      throw new Error('Invalid API key');
    }
  };

  const handleConfigureOverride = (workType: WorkTypeId) => {
    setSelectedWorkType(workType);
    setOverrideModalOpen(true);
  };

  const handleApplyOverride = (workType: WorkTypeId, model: ModelId) => {
    setFormData({
      ...formData!,
      models: {
        ...formData!.models,
        overrides: {
          ...formData!.models.overrides,
          [workType]: model,
        },
      },
    });
  };

  const handleRemoveOverride = (workType: WorkTypeId) => {
    const { [workType]: removed, ...remainingOverrides } = formData.models.overrides;
    setFormData({
      ...formData,
      models: {
        ...formData.models,
        overrides: remainingOverrides,
      },
    });
  };

  const handleSave = () => {
    if (formData) {
      saveMutation.mutate(formData);
    }
  };

  const handleReset = () => {
    setFormData(settings || null);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-2 mb-10">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-[#a078f7]">settings</span>
          <h1 className="text-4xl font-black tracking-tight">System Settings</h1>
        </div>
        <p className="text-[#a390cb] text-lg max-w-2xl">Configure global AI model orchestration, provider credentials, and optimization presets.</p>
      </div>

      {/* Preset Selector */}
      <PresetSelector selected={formData.models.preset} onChange={handlePresetChange} onPreview={handlePresetPreview} />

      {/* Provider Panel */}
      <ProviderPanel
        providers={formData.models.providers}
        apiKeys={formData.api_keys}
        thinkingLevel={formData.models.gemini_thinking_level || 3}
        onProviderToggle={handleProviderToggle}
        onApiKeyChange={handleApiKeyChange}
        onThinkingLevelChange={handleThinkingLevelChange}
        onTestConnection={handleTestConnection}
      />

      {/* Work Type Overrides */}
      <WorkTypeOverrides
        overrides={formData.models.overrides}
        presetModels={presetModels || {}}
        onConfigureOverride={handleConfigureOverride}
        onRemoveOverride={handleRemoveOverride}
      />

      {/* Preset Preview Modal */}
      <PresetPreviewModal
        preset={previewPreset || 'balanced'}
        isOpen={presetPreviewOpen}
        onClose={() => setPresetPreviewOpen(false)}
        onApply={handleApplyPreset}
        currentOverrides={formData.models.overrides}
      />

      {/* Override Config Modal */}
      <OverrideConfigModal
        workType={selectedWorkType}
        currentModel={selectedWorkType ? formData.models.overrides[selectedWorkType] : undefined}
        presetModel={selectedWorkType && presetModels ? presetModels[selectedWorkType] : undefined}
        availableModels={availableModels || { anthropic: [], openai: [], google: [], zai: [] }}
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        onApply={handleApplyOverride}
      />

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-4">
        <Button variant="secondary" onClick={handleReset} disabled={!hasChanges}>
          Reset to Defaults
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!hasChanges || saveMutation.isPending} loading={saveMutation.isPending}>
          Save Changes
        </Button>
      </div>

      {/* Save status */}
      {saveMutation.isSuccess && (
        <div className="bg-green-900/30 border border-green-700 rounded-md p-4 text-green-400 animate-fade-in">
          Settings saved successfully! Changes will apply to newly spawned agents.
        </div>
      )}
      {saveMutation.isError && (
        <div className="bg-red-900/30 border border-red-700 rounded-md p-4 text-red-400 animate-fade-in">
          Error: {(saveMutation.error as Error).message}
        </div>
      )}
    </div>
  );
}
