import { ReactNode } from 'react';
import { Brand } from '@/components/brand/Brand';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NewVisualSection = 'dashboard' | 'activities' | 'notes';

interface AppTopBarProps {
  username: string;
  onOpenSettings: () => void;
  onSignOut: () => void;
  selectedSection?: NewVisualSection;
  onSectionChange?: (section: NewVisualSection) => void;
  leadingSlot?: ReactNode;
  toolbarSlot?: ReactNode;
  className?: string;
}

export function AppTopBar({
  username,
  onOpenSettings,
  onSignOut,
  selectedSection,
  onSectionChange,
  leadingSlot,
  toolbarSlot,
  className,
}: AppTopBarProps) {
  const sectionButtons: Array<{ id: NewVisualSection; label: string }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'activities', label: 'Atividades' },
    { id: 'notes', label: 'Anotacoes' },
  ];

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur sm:px-4', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
        {leadingSlot}
        <Brand compact />
        {selectedSection && onSectionChange && (
          <div className="flex flex-wrap items-center gap-1 sm:ml-3">
            {sectionButtons.map((section) => (
              <Button
                key={section.id}
                type="button"
                variant={selectedSection === section.id ? 'secondary' : 'ghost'}
                size="sm"
                className="h-9 rounded-full px-3"
                onClick={() => onSectionChange(section.id)}
              >
                {section.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {toolbarSlot}

        <div className="hidden items-center gap-2 rounded-full border bg-muted/35 px-3 py-1.5 text-sm text-muted-foreground sm:flex">
          <User className="h-4 w-4" />
          <span className="max-w-[180px] truncate">{username}</span>
        </div>

        <Button variant="ghost" size="icon" onClick={onOpenSettings} className="h-9 w-9 rounded-full" aria-label="Abrir configuracoes">
          <Settings className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" onClick={onSignOut} className="h-9 w-9 rounded-full sm:hidden" aria-label="Sair">
          <LogOut className="h-4 w-4" />
        </Button>

        <Button variant="outline" size="sm" onClick={onSignOut} className="hidden h-9 rounded-full px-3 sm:inline-flex">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}
