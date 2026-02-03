import { Button } from '@/components/ui/button';
import { Monitor, Smartphone } from 'lucide-react';
import { MobileLayoutMode } from '@/types';

interface LayoutModeSelectorProps {
  currentMode: MobileLayoutMode;
  onModeChange: (mode: MobileLayoutMode) => void;
}

export function LayoutModeSelector({ currentMode, onModeChange }: LayoutModeSelectorProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 bg-background border rounded-lg shadow-lg p-1">
      <Button
        variant={currentMode === 'mobile' ? 'default' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        onClick={() => onModeChange('mobile')}
        title="Layout Mobile"
      >
        <Smartphone className="h-4 w-4" />
      </Button>
      <Button
        variant={currentMode === 'desktop' ? 'default' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        onClick={() => onModeChange('desktop')}
        title="Layout Desktop"
      >
        <Monitor className="h-4 w-4" />
      </Button>
    </div>
  );
}
