import { NoteEditor } from '@/components/notes/NoteEditor';
import { NoteFormattingHints } from '@/components/notes/NoteFormattingHints';
import { NotesSidebar } from '@/components/notes/NotesSidebar';
import { ActivityList } from '@/components/activities/ActivityList';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Brand } from '@/components/brand/Brand';
import { AppTopBar } from '@/components/layout/AppTopBar';
import { AppVisualModeSelector } from '@/components/layout/AppVisualModeSelector';
import { LogOut, User, Menu } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Activity, AppVisualMode, CustomField, Tag, SortOption, DailyNote, NoteSearchResult, LineType, ActivityListDisplaySettings, FilterConfig, NoteLine, NoteTemplate, LayoutSettings } from '@/types';
import { SaveStatus } from '@/hooks/useNotes';
import { useState } from 'react';

interface TabletLayoutProps {
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
  onUpdateLayoutSettings: (updates: Partial<LayoutSettings>) => void;
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
  onAppVisualModeChange: (mode: AppVisualMode) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  allowReopenCompleted: boolean;
}

export function TabletLayout({
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
  onUpdateLayoutSettings,
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
  onAppVisualModeChange,
  sortOption,
  onSortChange,
  allowReopenCompleted,
}: TabletLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      visualVariant="legacy"
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {appVisualMode === 'new' ? (
        <AppTopBar
          username={username}
          onOpenSettings={onOpenSettings}
          onSignOut={onSignOut}
          toolbarSlot={<AppVisualModeSelector value={appVisualMode} onChange={onAppVisualModeChange} />}
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
                  showDateButtons
                  onSelectDate={(date) => {
                    onDateChange(date);
                    setSidebarOpen(false);
                  }}
                  onSearch={onSearch}
                  onSelectSearchResult={(result) => {
                    onSelectSearchResult?.(result);
                    setSidebarOpen(false);
                  }}
                />
              </SheetContent>
            </Sheet>
          ) : undefined}
        />
      ) : (
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
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
                    showDateButtons
                    onSelectDate={(date) => {
                      onDateChange(date);
                      setSidebarOpen(false);
                    }}
                    onSearch={onSearch}
                    onSelectSearchResult={(result) => {
                      onSelectSearchResult?.(result);
                      setSidebarOpen(false);
                    }}
                  />
                </SheetContent>
              </Sheet>
            )}
            <Brand compact />
          </div>
          <div className="flex items-center gap-3">
            <AppVisualModeSelector value={appVisualMode} onChange={onAppVisualModeChange} />
            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <User className="h-4 w-4" />
              <span>{username}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onSignOut} className="hidden h-8 sm:inline-flex">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
            <Button variant="ghost" size="icon" onClick={onSignOut} className="h-8 w-8 sm:hidden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Main content - Two panels */}
      <div className="min-h-0 flex flex-1 overflow-hidden">
        {layout.showNotes && layout.showActivities ? (
          <ResizablePanelGroup
            direction="horizontal"
            className="flex-1"
            onLayout={(sizes) => {
              if (sizes.length === 2) {
                onUpdateLayoutSettings({ tabletNotesPanelSize: sizes[0] });
              }
            }}
          >
            <ResizablePanel defaultSize={layout.tabletNotesPanelSize} minSize={35}>
              {renderNotes()}
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={100 - layout.tabletNotesPanelSize} minSize={30}>
              {renderActivities()}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : layout.showNotes ? (
          <div className="flex-1">{renderNotes()}</div>
        ) : (
          <div className="flex-1">{renderActivities()}</div>
        )}
      </div>
    </div>
  );
}
