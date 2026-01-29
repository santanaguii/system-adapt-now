import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface NotesListProps {
  dates: string[];
  currentDate: string;
  onSelectDate: (date: string) => void;
  onClose: () => void;
}

export function NotesList({ dates, currentDate, onSelectDate, onClose }: NotesListProps) {
  // Group dates by month
  const groupedDates = dates.reduce((acc, date) => {
    const monthKey = format(new Date(date), 'MMMM yyyy', { locale: ptBR });
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(date);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="border-b bg-muted/30">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-sm font-medium">Todas as Notas</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="h-48">
        <div className="p-2">
          {Object.entries(groupedDates).map(([month, monthDates]) => (
            <div key={month} className="mb-3">
              <h4 className="text-xs font-medium text-muted-foreground px-2 py-1 capitalize">
                {month}
              </h4>
              <div className="space-y-0.5">
                {monthDates.map((date) => (
                  <button
                    key={date}
                    onClick={() => onSelectDate(date)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors text-left',
                      date === currentDate && 'bg-primary/10 text-primary'
                    )}
                  >
                    <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{format(new Date(date), "d 'de' MMMM", { locale: ptBR })}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {dates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma nota encontrada
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
