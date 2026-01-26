import { cn } from '../../../lib/utils';
import { Provider } from '../types';
import { Toggle } from '../Shared/Toggle';
import { StatusDot } from '../Shared/StatusDot';
import { ThinkingLevelSlider } from './ThinkingLevelSlider';
import { ApiKeyValidator } from './ApiKeyValidator';

export interface ProviderCardProps {
  provider: Provider;
  displayName: string;
  icon: string;
  iconColor: string;
  enabled: boolean;
  connected: boolean;
  apiKey?: string;
  locked?: boolean;
  showThinkingLevel?: boolean;
  thinkingLevel?: number;
  onToggle: () => void;
  onApiKeyChange: (key: string) => void;
  onThinkingLevelChange?: (level: number) => void;
  onTestConnection?: () => Promise<void>;
}

export function ProviderCard({
  provider,
  displayName,
  icon,
  iconColor,
  enabled,
  connected,
  apiKey,
  locked = false,
  showThinkingLevel = false,
  thinkingLevel = 3,
  onToggle,
  onApiKeyChange,
  onThinkingLevelChange,
}: ProviderCardProps) {
  const status = connected ? 'connected' : 'disconnected';

  return (
    <div className="bg-[#24283b] rounded-lg p-6 flex flex-col gap-5 border border-slate-700/50">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('size-10 rounded flex items-center justify-center', `bg-[${iconColor}]/20`)}>
            <span className="material-symbols-outlined" style={{ color: iconColor }}>
              {icon}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">{displayName}</h3>
            <span className="text-xs font-medium flex items-center gap-1">
              <StatusDot status={status} />
              {connected ? (
                <span className="text-[#10b981]">Connected</span>
              ) : (
                <span className="text-[#a390cb]">Not Configured</span>
              )}
            </span>
          </div>
        </div>
        <Toggle checked={enabled} onChange={onToggle} locked={locked} />
      </div>

      {/* API Key Input */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          enabled ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#a390cb] uppercase tracking-wider">API Key</label>
          <div className={cn('relative', showThinkingLevel && 'space-y-4')}>
            <ApiKeyValidator
              provider={provider}
              value={apiKey || ''}
              onChange={onApiKeyChange}
              disabled={locked}
              placeholder={`Enter ${provider === 'openai' ? 'sk-' : provider === 'google' ? 'AIza' : ''}...`}
            />

            {/* Gemini Thinking Level (Google only) */}
            {showThinkingLevel && connected && (
              <div className="pl-2 border-l-2 border-slate-700 ml-5">
                <ThinkingLevelSlider value={thinkingLevel} onChange={onThinkingLevelChange!} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
