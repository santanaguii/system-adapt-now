import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { ActivityList } from '@/components/activities/ActivityList';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings, FileText, CheckSquare } from 'lucide-react';
import { Activity, CustomField, Tag, SortOption, DailyNote, LineType, ActivityListDisplaySettings, FilterConfig, ActivityCreationMode } from '@/types';
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
  onSearch: (query: string) => DailyNote[];
  allDatesWithNotes: string[];
  saveStatus: SaveStatus;
  hasUnsavedChanges: boolean;
  autosaveEnabled: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  // Activities
  activities: { active: Activity[]; completed: Activity[] };
  tags: Tag[];
  customFields: CustomField[];
  listDisplay: ActivityListDisplaySettings;
  savedFilters: FilterConfig[];
  onAddActivity: (title: string, tags?: string[]) => Promise<Activity | null> | Activity | null;
  onUpdateActivity: (id: string, updates: Partial<Activity>) => void;
  onDeleteActivity: (id: string) => void;
  onToggleComplete: (id: string) => void;
  onReorderActivities: (startIndex: number, endIndex: number) => void;
  onOpenSettings: () => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  allowReopenCompleted: boolean;
  activityCreationMode: ActivityCreationMode;
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
  allDatesWithNotes,
  saveStatus,
  hasUnsavedChanges,
  autosaveEnabled,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
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
  activityCreationMode,
}: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState<'notes' | 'activities'>('notes');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span className="truncate max-w-[120px]">{username}</span>
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'notes' | 'activities')} className="flex-1 flex flex-col">
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

        <TabsContent value="notes" className="flex-1 m-0 overflow-hidden">
          <NoteEditor
            currentDate={currentDate}
            note={note}
            onDateChange={onDateChange}
            onUpdateLine={onUpdateLine}
            onAddLine={onAddLine}
            onDeleteLine={onDeleteLine}
            onToggleCollapse={onToggleCollapse}
            onUpdateIndent={onUpdateIndent}
            onSearch={onSearch}
            allDatesWithNotes={allDatesWithNotes}
            saveStatus={saveStatus}
            hasUnsavedChanges={hasUnsavedChanges}
            autosaveEnabled={autosaveEnabled}
            onSave={onSave}
            onUndo={onUndo}
            onRedo={onRedo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </TabsContent>

        <TabsContent value="activities" className="flex-1 m-0 overflow-hidden">
          <ActivityList
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
            activityCreationMode={activityCreationMode}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
