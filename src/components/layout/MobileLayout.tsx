import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { NoteFormattingHints } from '@/components/notes/NoteFormattingHints';
import { ActivityList } from '@/components/activities/ActivityList';
import { Button } from '@/components/ui/button';
import { Brand } from '@/components/brand/Brand';
import { LogOut, User, Settings, FileText, CheckSquare } from 'lucide-react';
import { Activity, CustomField, Tag, SortOption, DailyNote, NoteSearchResult, LineType, ActivityListDisplaySettings, FilterConfig, NoteLine, NoteTemplate } from '@/types';
import { SaveStatus } from '@/hooks/useNotes';

interface MobileLayoutProps {
  // User
  username: string;
  onSignOut: () => void;
  
  // Notes
  currentDate: Date;
  note: DailyNote;
  onDateChange: (date: Date) => void;
  onUpdateLine: (lineId: string, updates: { content?: string; type?: LineType }) => void;
  onAddLine: (afterLineId?: string, type?: LineType) => string;
  onDeleteLine: (lineId: string) => void;
  onToggleCollapse: (lineId: string) => void;
  onUpdateIndent: (lineId: string, delta: number) => void;
  onSearch: (query: string) => NoteSearchResult[];
  onSelectSearchResult?: (result: NoteSearchResult) => void;
  allDatesWithNotes: string[];
  saveStatus: SaveStatus;
  hasUnsavedChanges: boolean;
  autosaveEnabled: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCreateActivityFromLine?: (line: NoteLine) => void;
  onOpenDetailedActivityFromLine?: (line: NoteLine) => void;
  activityCreatedLineIds?: string[];
  highlightedLineIds?: string[];
  searchFocusKey?: string | null;
  noteTemplates?: NoteTemplate[];
  
  // Activities
  activities: { active: Activity[]; completed: Activity[] };
  tags: Tag[];
  customFields: CustomField[];
  listDisplay: ActivityListDisplaySettings;
  savedFilters: FilterConfig[];
  onAddActivity: (title: string, tags?: string[], customFields?: Activity['customFields']) => Promise<Activity | null> | Activity | null;
  onUpdateActivity: (id: string, updates: Partial<Activity>) => void;
  onDeleteActivity: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onReorderActivities: (startIndex: number, endIndex: number) => void;
  onOpenSettings: () => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  allowReopenCompleted: boolean;
}

export function MobileLayout({
  username,
  onSignOut,
  currentDate,
  note,
  onDateChange,
  onUpdateLine,
  onAddLine,
  onDeleteLine,
  onToggleCollapse,
  onUpdateIndent,
  onSearch,
  onSelectSearchResult,
  allDatesWithNotes,
  saveStatus,
  hasUnsavedChanges,
  autosaveEnabled,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onCreateActivityFromLine,
  onOpenDetailedActivityFromLine,
  activityCreatedLineIds,
  highlightedLineIds,
  searchFocusKey,
  noteTemplates,
  activities,
  tags,
  customFields,
  listDisplay,
  savedFilters,
  onAddActivity,
  onUpdateActivity,
  onDeleteActivity,
  onToggleComplete,
  onReorderActivities,
  onOpenSettings,
  sortOption,
  onSortChange,
  allowReopenCompleted,
}: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState<'notes' | 'activities'>('notes');

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <div className="min-w-0">
          <Brand compact />
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span className="truncate max-w-[150px]">{username}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onOpenSettings} className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onSignOut} className="h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'notes' | 'activities')} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="grid w-full grid-cols-2 rounded-none border-b">
          <TabsTrigger value="notes" className="flex items-center gap-2 data-[state=active]:bg-background">
            <FileText className="h-4 w-4" />
            Notas
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-2 data-[state=active]:bg-background">
            <CheckSquare className="h-4 w-4" />
            Atividades
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="m-0 min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <NoteEditor
              currentDate={currentDate}
              note={note}
              onDateChange={onDateChange}
              onUpdateLine={onUpdateLine}
              onAddLine={onAddLine}
              onDeleteLine={onDeleteLine}
              onToggleCollapse={onToggleCollapse}
              onUpdateIndent={onUpdateIndent}
              saveStatus={saveStatus}
              hasUnsavedChanges={hasUnsavedChanges}
              autosaveEnabled={autosaveEnabled}
              onSave={onSave}
              onUndo={onUndo}
              onRedo={onRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              onCreateActivityFromLine={onCreateActivityFromLine}
              onOpenDetailedActivityFromLine={onOpenDetailedActivityFromLine}
              activityCreatedLineIds={activityCreatedLineIds}
              highlightedLineIds={highlightedLineIds}
              searchFocusKey={searchFocusKey}
              noteTemplates={noteTemplates}
            />
            <NoteFormattingHints />
          </div>
        </TabsContent>

        <TabsContent value="activities" className="m-0 min-h-0 flex-1 overflow-hidden">
          <ActivityList
            currentDate={currentDate}
            activities={activities}
            tags={tags}
            customFields={customFields}
            listDisplay={listDisplay}
            savedFilters={savedFilters}
            onAdd={onAddActivity}
            onUpdate={onUpdateActivity}
            onDelete={onDeleteActivity}
            onToggleComplete={onToggleComplete}
            onReorder={onReorderActivities}
            onOpenSettings={onOpenSettings}
            sortOption={sortOption}
            onSortChange={onSortChange}
            allowReopenCompleted={allowReopenCompleted}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
