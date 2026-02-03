import { useState, useCallback, useEffect } from 'react';
import { useActivities } from '@/hooks/useActivities';
import { useNotes } from '@/hooks/useNotes';
import { useSettings } from '@/hooks/useSettings';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAppearanceContext } from '@/contexts/AppearanceContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { ActivityList } from '@/components/activities/ActivityList';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { NotesSidebar } from '@/components/notes/NotesSidebar';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { TabletLayout } from '@/components/layout/TabletLayout';
import { LayoutModeSelector } from '@/components/layout/LayoutModeSelector';
import { Button } from '@/components/ui/button';
import { LineType, SortOption } from '@/types';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { LogOut, User } from 'lucide-react';
import { format } from 'date-fns';

// Breakpoints
const MOBILE_MAX = 768;
const TABLET_MAX = 1024;

const Index = () => {
  const { user, signOut } = useAuthContext();
  const { appearance, updateAppearance } = useAppearanceContext();
  const isMobileDevice = useIsMobile();
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('manual');

  // Track window width for tablet detection
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isTablet = windowWidth > MOBILE_MAX && windowWidth <= TABLET_MAX;
  const isMobile = windowWidth <= MOBILE_MAX;

  const {
    settings,
    addCustomField,
    updateCustomField,
    deleteCustomField,
    addTag,
    updateTag,
    deleteTag,
    updateGeneralSettings,
    updateListDisplay,
    updateSavedFilters,
    updateSavedSort,
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
    hasUnsavedChanges,
    saveAllPending,
    discardChanges,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useNotes(settings.autosaveEnabled);

  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingDateChange, setPendingDateChange] = useState<Date | null>(null);

  // Handle date change with unsaved changes check
  const handleDateChange = useCallback((newDate: Date) => {
    if (hasUnsavedChanges && !settings.autosaveEnabled) {
      setPendingDateChange(newDate);
      setShowUnsavedDialog(true);
    } else {
      setCurrentDate(newDate);
    }
  }, [hasUnsavedChanges, settings.autosaveEnabled]);

  const handleSaveAndContinue = useCallback(async () => {
    await saveAllPending();
    if (pendingDateChange) {
      setCurrentDate(pendingDateChange);
      setPendingDateChange(null);
    }
    setShowUnsavedDialog(false);
  }, [saveAllPending, pendingDateChange]);

  const handleDiscardAndContinue = useCallback(() => {
    discardChanges();
    if (pendingDateChange) {
      setCurrentDate(pendingDateChange);
      setPendingDateChange(null);
    }
    setShowUnsavedDialog(false);
  }, [discardChanges, pendingDateChange]);

  const handleCancelNavigation = useCallback(() => {
    setPendingDateChange(null);
    setShowUnsavedDialog(false);
  }, []);

  // Ctrl+S global handler for manual save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveAllPending();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveAllPending]);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !settings.autosaveEnabled) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, settings.autosaveEnabled]);

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

  // Convert dates to string format for components that expect it
  const allDatesWithNotesStrings = allDatesWithNotes.map(d => format(d, 'yyyy-MM-dd'));

  // Common props for layouts
  const commonProps = {
    username: user?.username || '',
    onSignOut: signOut,
    currentDate,
    note: currentNote,
    onDateChange: handleDateChange,
    onUpdateLine: handleUpdateLine,
    onAddLine: handleAddLine,
    onDeleteLine: handleDeleteLine,
    onToggleCollapse: handleToggleCollapse,
    onUpdateIndent: handleUpdateIndent,
    onSearch: searchNotes,
    allDatesWithNotes: allDatesWithNotesStrings,
    saveStatus,
    hasUnsavedChanges,
    autosaveEnabled: settings.autosaveEnabled,
    onSave: saveAllPending,
    onUndo: undo,
    onRedo: redo,
    canUndo,
    canRedo,
    activities: sortedActivities,
    tags: settings.tags,
    customFields: settings.customFields,
    listDisplay: settings.listDisplay,
    savedFilters: settings.savedFilters,
    onAddActivity: addActivity,
    onUpdateActivity: updateActivity,
    onDeleteActivity: deleteActivity,
    onToggleComplete: toggleComplete,
    onReorderActivities: reorderActivities,
    onOpenSettings: () => setSettingsOpen(true),
    sortOption,
    onSortChange: setSortOption,
    allowReopenCompleted: settings.allowReopenCompleted,
    activityCreationMode: settings.activityCreationMode,
  };

  // Determine which layout to use
  const useMobileLayout = isMobile && appearance.mobileLayoutMode === 'mobile';
  const showLayoutSelector = isMobile;

  const renderContent = () => {
    // Mobile with mobile layout preference
    if (useMobileLayout) {
      return <MobileLayout {...commonProps} />;
    }

    // Tablet layout (or mobile with desktop preference)
    if (isTablet || (isMobile && appearance.mobileLayoutMode === 'desktop')) {
      return <TabletLayout {...commonProps} />;
    }

    // Desktop layout
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
                dates={allDatesWithNotesStrings}
                currentDate={currentDate}
                onSelectDate={handleDateChange}
                onSearch={searchNotes}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Note Editor */}
            <ResizablePanel defaultSize={45} minSize={25}>
              <NoteEditor
                currentDate={currentDate}
                note={currentNote}
                onDateChange={handleDateChange}
                onUpdateLine={handleUpdateLine}
                onAddLine={handleAddLine}
                onDeleteLine={handleDeleteLine}
                onToggleCollapse={handleToggleCollapse}
                onUpdateIndent={handleUpdateIndent}
                onSearch={searchNotes}
                allDatesWithNotes={allDatesWithNotesStrings}
                saveStatus={saveStatus}
                hasUnsavedChanges={hasUnsavedChanges}
                autosaveEnabled={settings.autosaveEnabled}
                onSave={saveAllPending}
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
                listDisplay={settings.listDisplay}
                savedFilters={settings.savedFilters}
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
      </div>
    );
  };

  return (
    <>
      {renderContent()}

      {/* Layout Mode Selector - only on mobile */}
      {showLayoutSelector && (
        <LayoutModeSelector
          currentMode={appearance.mobileLayoutMode}
          onModeChange={(mode) => updateAppearance({ mobileLayoutMode: mode })}
        />
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        customFields={settings.customFields}
        tags={settings.tags}
        activityCreationMode={settings.activityCreationMode}
        allowReopenCompleted={settings.allowReopenCompleted}
        autosaveEnabled={settings.autosaveEnabled}
        appearance={appearance}
        listDisplay={settings.listDisplay}
        savedFilters={settings.savedFilters}
        savedSort={settings.savedSort}
        onAddField={addCustomField}
        onUpdateField={updateCustomField}
        onDeleteField={deleteCustomField}
        onAddTag={addTag}
        onUpdateTag={updateTag}
        onDeleteTag={deleteTag}
        onUpdateGeneralSettings={updateGeneralSettings}
        onUpdateAppearance={updateAppearance}
        onUpdateListDisplay={updateListDisplay}
        onUpdateFilters={updateSavedFilters}
        onUpdateSort={updateSavedSort}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onSave={handleSaveAndContinue}
        onDiscard={handleDiscardAndContinue}
        onCancel={handleCancelNavigation}
      />
    </>
  );
};

export default Index;
