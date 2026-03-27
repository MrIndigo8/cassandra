'use client';

interface FeatureToggleProps {
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}

export default function FeatureToggle({ label, description, enabled, onToggle, disabled }: FeatureToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description ? <p className="text-xs text-text-muted">{description}</p> : null}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(!enabled)}
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
        } disabled:opacity-50`}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
