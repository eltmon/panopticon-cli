import { cn } from '../../../lib/utils';
import { ModelPreset, PRESET_CONFIGS } from '../types';
import { CostIndicator } from './CostIndicator';

export interface PresetCardProps {
  preset: ModelPreset;
  selected: boolean;
  onSelect: () => void;
  onPreview?: () => void;
}

const PRESET_COLORS: Record<ModelPreset, { border: string; bg: string; accent: string }> = {
  premium: { border: 'border-[#fbbf24]', bg: 'ring-[#fbbf24]', accent: '#fbbf24' },
  balanced: { border: 'border-[#a078f7]', bg: 'ring-[#a078f7]', accent: '#a078f7' },
  budget: { border: 'border-[#10b981]', bg: 'ring-[#10b981]', accent: '#10b981' },
};

export function PresetCard({ preset, selected, onSelect, onPreview }: PresetCardProps) {
  const config = PRESET_CONFIGS[preset];
  const colors = PRESET_COLORS[preset];

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when clicking preview
    onPreview?.();
  };

  return (
    <div
      className={cn(
        'relative bg-[#24283b] border-l-4 rounded-lg p-6 flex flex-col gap-4 group cursor-pointer hover:bg-[#24283b]/80 transition-all border border-transparent',
        colors.border,
        selected && `ring-2 ${colors.bg} shadow-[0_0_15px_rgba(160,120,247,0.2)]`
      )}
      onClick={onSelect}
    >
      {/* Icon and Radio Button */}
      <div className="flex justify-between items-start">
        <span
          className="material-symbols-outlined text-3xl"
          style={{ color: colors.accent }}
        >
          {config.icon}
        </span>
        <div className={cn('size-5 rounded-full border-2 flex items-center justify-center', selected ? `border-[${colors.accent}]` : 'border-slate-600')}>
          {selected && <div className="size-2.5 rounded-full" style={{ backgroundColor: colors.accent }} />}
        </div>
      </div>

      {/* Title and Subtitle */}
      <div>
        <p className="text-white text-xl font-bold">{config.displayName}</p>
        <p className="text-[#a390cb] text-sm mt-1">{config.subtitle}</p>
      </div>

      {/* Bullet Points */}
      <ul className="text-sm text-[#a390cb] space-y-2">
        {config.bulletPoints.map((point, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xs">check_circle</span>
            {point}
          </li>
        ))}
      </ul>

      {/* Cost Meter */}
      <CostIndicator level={config.costLevel} color={colors.accent} />

      {/* Preview Button */}
      {onPreview && (
        <button
          onClick={handlePreviewClick}
          className="mt-2 w-full bg-slate-800/50 hover:bg-slate-700/50 text-white text-sm font-medium py-2 rounded-md transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-base">visibility</span>
          Preview Full Configuration
        </button>
      )}
    </div>
  );
}
