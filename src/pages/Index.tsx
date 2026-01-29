import { useState, useCallback } from 'react';
import { useActivities } from '@/hooks/useActivities';
import { useNotes } from '@/hooks/useNotes';
import { useSettings } from '@/hooks/useSettings';
import { useAuthContext } from '@/contexts/AuthContext';
import { ActivityList } from '@/components/activities/ActivityList';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { NotesSidebar } from '@/components/notes/NotesSidebar';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { Button } from '@/components/ui/button';
import { LineType, SortOption } from '@/types';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { LogOut, User } from 'lucide-react';

const Index = () => {
  const { user, signOut } = useAuthContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('manual');

  const {
    settings,
    addCustomField,
    updateCustomField,
    deleteCustomField,
    addTag,
    updateTag,
    deleteTag,
    updateGeneralSettings,
  } = useSettings();

  const {
    sortedActivities,
    addActivity,
    updateActivity,
    deleteActivity,
    toggleComplete,
    reorderActivities,
  } = useActivities(sortOption, settings.customFields);

  const { 
    getNote, 
    updateLine, 
    addLine, 
    deleteLine, 
    toggleLineCollapsed,
    updateLineIndent,
    searchNotes,
    allDatesWithNotes,
    saveStatus,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useNotes();

  const currentNote = getNote(currentDate);

  const handleUpdateLine = useCallback(
    (lineId: string, updates: { content?: string; type?: LineType }) => {
      updateLine(currentDate, lineId, updates);
    },
    [currentDate, updateLine]
  );

  const handleAddLine = useCallback(
    (afterLineId?: string, type?: LineType) => {
      return addLine(currentDate, afterLineId, type);
    },
    [currentDate, addLine]
  );

  const handleDeleteLine = useCallback(
    (lineId: string) => {
      deleteLine(currentDate, lineId);
    },
    [currentDate, deleteLine]
  );

  const handleToggleCollapse = useCallback(
    (lineId: string) => {
      toggleLineCollapsed(currentDate, lineId);
    },
    [currentDate, toggleLineCollapsed]
  );

  const handleUpdateIndent = useCallback(
    (lineId: string, delta: number) => {
      updateLineIndent(currentDate, lineId, delta);
    },
    [currentDate, updateLineIndent]
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar with user info */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{user?.username}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="h-8">
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>

      {/* Main content with resizable panels */}
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Notes Sidebar */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
            <NotesSidebar
              dates={allDatesWithNotes}
              currentDate={currentDate}
              onSelectDate={setCurrentDate}
              onSearch={searchNotes}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Note Editor */}
          <ResizablePanel defaultSize={45} minSize={25}>
            <NoteEditor
              currentDate={currentDate}
              note={currentNote}
              onDateChange={setCurrentDate}
              onUpdateLine={handleUpdateLine}
              onAddLine={handleAddLine}
              onDeleteLine={handleDeleteLine}
              onToggleCollapse={handleToggleCollapse}
              onUpdateIndent={handleUpdateIndent}
              onSearch={searchNotes}
              allDatesWithNotes={allDatesWithNotes}
              saveStatus={saveStatus}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Activities Panel */}
          <ResizablePanel defaultSize={35} minSize={20}>
            <ActivityList
              activities={sortedActivities}
              tags={settings.tags}
              customFields={settings.customFields}
              onAdd={addActivity}
              onUpdate={updateActivity}
              onDelete={deleteActivity}
              onToggleComplete={toggleComplete}
              onReorder={reorderActivities}
              onOpenSettings={() => setSettingsOpen(true)}
              sortOption={sortOption}
              onSortChange={setSortOption}
              allowReopenCompleted={settings.allowReopenCompleted}
              activityCreationMode={settings.activityCreationMode}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        customFields={settings.customFields}
        tags={settings.tags}
        activityCreationMode={settings.activityCreationMode}
        allowReopenCompleted={settings.allowReopenCompleted}
        onAddField={addCustomField}
        onUpdateField={updateCustomField}
        onDeleteField={deleteCustomField}
        onAddTag={addTag}
        onUpdateTag={updateTag}
        onDeleteTag={deleteTag}
        onUpdateGeneralSettings={updateGeneralSettings}
      />
    </div>
  );
};

export default Index;
