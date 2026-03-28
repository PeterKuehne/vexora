/**
 * ModelSelector Component - Shows the active AI model
 *
 * Simplified: Single model (gpt-oss-120b via OVH EU-Cloud).
 * No dropdown needed — displays model info as static badge.
 */

import { Cloud } from 'lucide-react';
import { useTheme } from '../contexts';

export interface Model {
  id: string;
  name: string;
  family: string;
  parameterSize: string;
  quantization: string;
  sizeGB: number;
  isDefault: boolean;
}

export interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  showDetails?: boolean;
  autoLoad?: boolean;
  autoFallback?: boolean;
  onModelUnavailable?: (unavailableModelId: string, fallbackModelId: string | null) => void;
}

export default function ModelSelector({ className }: ModelSelectorProps) {
  const { isDark } = useTheme();

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs ${
      isDark ? 'bg-white/5 text-white/50' : 'bg-gray-100 text-gray-500'
    } ${className || ''}`}>
      <Cloud className="w-3 h-3" />
      <span>GPT-OSS 120B</span>
      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
        isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
      }`}>
        EU
      </span>
    </div>
  );
}
