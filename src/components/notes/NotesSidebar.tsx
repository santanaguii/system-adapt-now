import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Search, Plus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DailyNote } from '@/types';

interface NotesSidebarProps {
  dates: string[];
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  onSearch: (query: string) => DailyNote[];
}

export function NotesSidebar({ dates, currentDate, onSelectDate, onSearch }: NotesSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DailyNote[]>([]);
  const currentDateStr = format(currentDate, 'yyyy-MM-dd');

  useEffect(() => {
    if (searchQuery.trim()) {
      const results = onSearch(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, onSearch]);

  // Parse date string to local Date (avoiding UTC interpretation)
  const parseDateString = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Group dates by month
  const groupedDates = dates.reduce((acc, date) => {
    const monthKey = format(parseDateString(date), 'MMMM yyyy', { locale: ptBR });
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(date);
    return acc;
  }, {} as Record<string, string[]>);

  const handleNewNote = () => {
    onSelectDate(new Date());
  };

  const isToday = (date: string) => {
    return date === format(new Date(), 'yyyy-MM-dd');
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">Notas</h2>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Selecionar data">
                <Calendar className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="single"
                selected={currentDate}
                onSelect={(date) => date && onSelectDate(date)}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewNote} title="Nova nota (hoje)">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar notas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Search Results or Notes List */}
      <ScrollArea className="flex-1">
        {searchQuery.trim() ? (
          <div className="p-2">
            {searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((result) => (
                  <button
                    key={result.date}
                    onClick={() => {
                      onSelectDate(parseDateString(result.date));
                      setSearchQuery('');
                    }}
                    className={cn(
                      'w-full flex flex-col gap-0.5 px-3 py-2 rounded text-sm hover:bg-muted transition-colors text-left',
                      result.date === currentDateStr && 'bg-primary/10 text-primary'
                    )}
                  >
                    <span className="font-medium">
                      {format(parseDateString(result.date), "d 'de' MMMM", { locale: ptBR })}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {result.lines[0]?.content.substring(0, 60)}...
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum resultado encontrado
              </p>
            )}
          </div>
        ) : (
          <div className="p-2">
            {Object.entries(groupedDates).map(([month, monthDates]) => (
              <div key={month} className="mb-4">
                <h4 className="text-xs font-medium text-muted-foreground px-2 py-1.5 capitalize sticky top-0 bg-muted/30">
                  {month}
                </h4>
                <div className="space-y-0.5">
                  {monthDates.map((date) => (
                    <button
                      key={date}
                      onClick={() => onSelectDate(parseDateString(date))}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-muted transition-colors text-left',
                        date === currentDateStr && 'bg-primary/10 text-primary'
                      )}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1">
                        {format(parseDateString(date), "d 'de' MMMM", { locale: ptBR })}
                      </span>
                      {isToday(date) && (
                        <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                          Hoje
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {dates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma nota ainda
              </p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
