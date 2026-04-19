import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { NoteFormattingHints } from '@/components/notes/NoteFormattingHints';
import { NotesSidebar } from '@/components/notes/NotesSidebar';
import { ActivityList } from '@/components/activities/ActivityList';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Brand } from '@/components/brand/Brand';
import { AppTopBar } from '@/components/layout/AppTopBar';
import { LogOut, User, Settings, FileText, CheckSquare, Menu, ArrowRightLeft } from 'lucide-react';
import { Activity, AppVisualMode, CustomField, Tag, SortOption, DailyNote, NoteSearchResult, LineType, ActivityListDisplaySettings, FilterConfig, NoteLine, NoteTemplate, LayoutSettings } from '@/types';
import { SaveStatus } from '@/hooks/useNotes';

interface MobileLayoutProps {
  // User
  username: string;
  onSignOut: () => void;
  appVisualMode: AppVisualMode;
  
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
  noteDateButtonsEnabled: boolean;
  quickRescheduleDaysThreshold: number;
  layout: LayoutSettings;
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
  appVisualMode,
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
  noteDateButtonsEnabled,
  quickRescheduleDaysThreshold,
  layout,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!layout.showNotes && layout.showActivities) {
      setActiveTab('activities');
      return;
    }

    if (!layout.showActivities && layout.showNotes) {
      setActiveTab('notes');
    }
  }, [layout.showActivities, layout.showNotes]);

  const resolvedActiveTab = activeTab === 'notes'
    ? (layout.showNotes ? 'notes' : 'activities')
    : (layout.showActivities ? 'activities' : 'notes');

  const renderNotes = () => (
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
        showDateButtons
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
  );

  const renderActivities = () => (
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
      showQuickRescheduleButtons={noteDateButtonsEnabled}
      quickRescheduleDaysThreshold={quickRescheduleDaysThreshold}
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {appVisualMode === 'new' ? (
        <AppTopBar
          username={username}
          onOpenSettings={onOpenSettings}
          onSignOut={onSignOut}
          leadingSlot={layout.showNotesList && layout.showNotes ? (
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <NotesSidebar
                  dates={allDatesWithNotes}
                  currentDate={currentDate}
                  showDateButtons={noteDateButtonsEnabled}
                  onSelectDate={(date) => {
                    onDateChange(date);
                    setActiveTab('notes');
                    setSidebarOpen(false);
                  }}
                  onSearch={onSearch}
                  onSelectSearchResult={(result) => {
                    onSelectSearchResult?.(result);
                    setActiveTab('notes');
                    setSidebarOpen(false);
                  }}
                />
              </SheetContent>
            </Sheet>
          ) : undefined}
        />
      ) : (
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {layout.showNotesList && layout.showNotes && (
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0">
                  <NotesSidebar
                    dates={allDatesWithNotes}
                    currentDate={currentDate}
                    showDateButtons={noteDateButtonsEnabled}
                    onSelectDate={(date) => {
                      onDateChange(date);
                      setActiveTab('notes');
                      setSidebarOpen(false);
                    }}
                    onSearch={onSearch}
                    onSelectSearchResult={(result) => {
                      onSelectSearchResult?.(result);
                      setActiveTab('notes');
                      setSidebarOpen(false);
                    }}
                  />
                </SheetContent>
              </Sheet>
            )}

            <div className="min-w-0">
              <Brand compact />
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span className="truncate max-w-[120px]">{username}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!layout.showTabs && layout.showNotes && layout.showActivities && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab((current) => current === 'notes' ? 'activities' : 'notes')}
                className="h-8 gap-1 px-2"
                title={resolvedActiveTab === 'notes' ? 'Mostrar atividades' : 'Mostrar notas'}
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span className="text-xs">{resolvedActiveTab === 'notes' ? 'Ativ.' : 'Notas'}</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onOpenSettings} className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onSignOut} className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {layout.showNotes && layout.showActivities ? (
        layout.showTabs ? (
          <Tabs
            value={resolvedActiveTab}
            onValueChange={(value) => setActiveTab(value as 'notes' | 'activities')}
            className="flex min-h-0 flex-1 flex-col"
          >
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
              {renderNotes()}
            </TabsContent>

            <TabsContent value="activities" className="m-0 min-h-0 flex-1 overflow-hidden">
              {renderActivities()}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            {resolvedActiveTab === 'notes' ? renderNotes() : renderActivities()}
          </div>
        )
      ) : layout.showNotes ? (
        <div className="min-h-0 flex-1 overflow-hidden">{renderNotes()}</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">{renderActivities()}</div>
      )}
    </div>
  );
}
