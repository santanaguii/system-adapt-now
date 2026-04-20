import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppVisualMode } from '@/types';

interface AppVisualModeSelectorProps {
  value: AppVisualMode;
  onChange: (mode: AppVisualMode) => void;
  className?: string;
}

export function AppVisualModeSelector({ value, onChange, className }: AppVisualModeSelectorProps) {
  return (
    <div className={className}>
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue as AppVisualMode)}>
        <SelectTrigger className="h-9 min-w-[170px] rounded-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="current">Visual anterior</SelectItem>
          <SelectItem value="new">Novo visual</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
