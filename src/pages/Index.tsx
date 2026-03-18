import { Suspense, lazy, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useActivities } from '@/hooks/useActivities';
import { useNotes } from '@/hooks/useNotes';
import { useSettings } from '@/hooks/useSettings';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAppearanceContext } from '@/contexts/AppearanceContext';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Brand } from '@/components/brand/Brand';
import {
  Activity,
  AppearanceSettings,
  CustomField,
  FilterConfig,
  LineType,
  NoteLine,
  NoteSearchResult,
  NoteTemplate,
  SortConfig,
  SortOption,
  Tag,
} from '@/types';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Loader2, LogOut, User } from 'lucide-react';
import { format } from 'date-fns';
import { ACTIVITY_META, buildDependencySyncUpdates, createMetaPatch, getSourceLineIds } from '@/lib/activity-meta';
import { formatDateKey, getDateKeyInTimeZone } from '@/lib/date';

const ActivityList = lazy(() =>
  import('@/components/activities/ActivityList').then((module) => ({ default: module.ActivityList }))
);
const NoteEditor = lazy(() =>
  import('@/components/notes/NoteEditor').then((module) => ({ default: module.NoteEditor }))
);
const NotesSidebar = lazy(() =>
  import('@/components/notes/NotesSidebar').then((module) => ({ default: module.NotesSidebar }))
);
const NoteFormattingHints = lazy(() =>
  import('@/components/notes/NoteFormattingHints').then((module) => ({ default: module.NoteFormattingHints }))
);
const SettingsPanel = lazy(() =>
  import('@/components/settings/SettingsPanel').then((module) => ({ default: module.SettingsPanel }))
);
type SettingsPanelPreview = import('@/components/settings/SettingsPanel').SettingsPanelPreview;
const ActivityCreateDialog = lazy(() =>
  import('@/components/activities/ActivityCreateDialog').then((module) => ({ default: module.ActivityCreateDialog }))
);
const ActivityDetail = lazy(() =>
  import('@/components/activities/ActivityDetail').then((module) => ({ default: module.ActivityDetail }))
);
const MobileLayout = lazy(() =>
  import('@/components/layout/MobileLayout').then((module) => ({ default: module.MobileLayout }))
);
const TabletLayout = lazy(() =>
  import('@/components/layout/TabletLayout').then((module) => ({ default: module.TabletLayout }))
);
const LayoutModeSelector = lazy(() =>
  import('@/components/layout/LayoutModeSelector').then((module) => ({ default: module.LayoutModeSelector }))
);

const MOBILE_MAX = 768;
const TABLET_MAX = 1024;

interface SettingsPreviewState {
  allowReopenCompleted: boolean;
  autosaveEnabled: boolean;
  noteDateButtonsEnabled: boolean;
  quickRescheduleDaysThreshold: number;
  appearance: AppearanceSettings;
  listDisplay: import('@/types').ActivityListDisplaySettings;
  savedFilters: FilterConfig[];
  savedSort: SortConfig;
  customFields: CustomField[];
  tags: Tag[];
  noteTemplates: NoteTemplate[];
}

function SectionFallback() {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

const Index = () => {
  const { user, signOut } = useAuthContext();
  const { appearance, updateAppearance, setPreviewAppearance } = useAppearanceContext();
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPreview, setSettingsPreview] = useState<SettingsPreviewState | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('manual');
  const [pendingLineToConvert, setPendingLineToConvert] = useState<NoteLine | null>(null);
  const [showCreateDialogFromNote, setShowCreateDialogFromNote] = useState(false);
  const [selectedActivityFromNote, setSelectedActivityFromNote] = useState<Activity | null>(null);
  const [activeNoteSearchFlash, setActiveNoteSearchFlash] = useState<(NoteSearchResult & { flashKey: string }) | null>(null);
  const [pendingSearchSelection, setPendingSearchSelection] = useState<NoteSearchResult | null>(null);
  const searchFlashTimeoutRef = useRef<number | null>(null);

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
    updateNoteTemplates,
  } = useSettings();

  const {
    activities,
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

  const clearSearchFlash = useCallback(() => {
    if (searchFlashTimeoutRef.current !== null) {
      window.clearTimeout(searchFlashTimeoutRef.current);
      searchFlashTimeoutRef.current = null;
    }
    setActiveNoteSearchFlash(null);
  }, []);

  const applySearchSelection = useCallback((result: NoteSearchResult) => {
    const selectedDate = new Date(`${result.date}T12:00:00`);
    const flashKey = `${result.date}:${result.primaryLineId}:${result.matchStart}:${Date.now()}`;

    setCurrentDate(selectedDate);
    if (searchFlashTimeoutRef.current !== null) {
      window.clearTimeout(searchFlashTimeoutRef.current);
    }
    setActiveNoteSearchFlash({ ...result, flashKey });
    searchFlashTimeoutRef.current = window.setTimeout(() => {
      setActiveNoteSearchFlash((current) => current?.flashKey === flashKey ? null : current);
      searchFlashTimeoutRef.current = null;
    }, 1200);
  }, []);

  const handleDateChange = useCallback((newDate: Date) => {
    if (hasUnsavedChanges && !settings.autosaveEnabled) {
      setPendingDateChange(newDate);
      setPendingSearchSelection(null);
      setShowUnsavedDialog(true);
    } else {
      setCurrentDate(newDate);
      clearSearchFlash();
    }
  }, [clearSearchFlash, hasUnsavedChanges, settings.autosaveEnabled]);

  const handleSelectSearchResult = useCallback((result: NoteSearchResult) => {
    const selectedDate = new Date(`${result.date}T12:00:00`);

    if (hasUnsavedChanges && !settings.autosaveEnabled) {
      setPendingDateChange(selectedDate);
      setPendingSearchSelection(result);
      setShowUnsavedDialog(true);
      return;
    }

    applySearchSelection(result);
  }, [applySearchSelection, hasUnsavedChanges, settings.autosaveEnabled]);

  const handleSaveAndContinue = useCallback(async () => {
    await saveAllPending();
    if (pendingDateChange) {
      if (pendingSearchSelection) {
        applySearchSelection(pendingSearchSelection);
      } else {
        setCurrentDate(pendingDateChange);
        clearSearchFlash();
      }
      setPendingDateChange(null);
      setPendingSearchSelection(null);
    }
    setShowUnsavedDialog(false);
  }, [applySearchSelection, clearSearchFlash, pendingDateChange, pendingSearchSelection, saveAllPending]);

  const handleDiscardAndContinue = useCallback(() => {
    discardChanges();
    if (pendingDateChange) {
      if (pendingSearchSelection) {
        applySearchSelection(pendingSearchSelection);
      } else {
        setCurrentDate(pendingDateChange);
        clearSearchFlash();
      }
      setPendingDateChange(null);
      setPendingSearchSelection(null);
    }
    setShowUnsavedDialog(false);
  }, [applySearchSelection, clearSearchFlash, discardChanges, pendingDateChange, pendingSearchSelection]);

  const handleCancelNavigation = useCallback(() => {
    setPendingDateChange(null);
    setPendingSearchSelection(null);
    setShowUnsavedDialog(false);
  }, []);

  useEffect(() => {
    return () => {
      if (searchFlashTimeoutRef.current !== null) {
        window.clearTimeout(searchFlashTimeoutRef.current);
      }
    };
  }, []);

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
  const pendingLineInitialTitle = useMemo(
    () => pendingLineToConvert?.content.trim() ?? '',
    [pendingLineToConvert]
  );
  const pendingLineInitialCustomFields = useMemo(
    () => {
      if (!pendingLineToConvert) {
        return null;
      }

      return createMetaPatch({
        [ACTIVITY_META.bucket]: formatDateKey(currentDate) <= getDateKeyInTimeZone() ? 'today' : 'upcoming',
        dueDate: formatDateKey(currentDate),
        [ACTIVITY_META.linkedNoteDates]: [formatDateKey(currentDate)],
        [ACTIVITY_META.sourceLineIds]: [pendingLineToConvert.id],
      });
    },
    [currentDate, pendingLineToConvert]
  );
  const activityCreatedLineIds = useMemo(
    () => activities.flatMap((activity) => getSourceLineIds(activity)),
    [activities]
  );
  const activityByLineId = useMemo(
    () => new Map(
      activities.flatMap((activity) => getSourceLineIds(activity).map((lineId) => [lineId, activity] as const))
    ),
    [activities]
  );
  const allActivities = activities;

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

  const handleOpenDetailedActivityFormFromLine = useCallback((line: NoteLine) => {
    if (!line.content.trim()) {
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setPendingLineToConvert(line);
    setShowCreateDialogFromNote(true);
  }, []);

  const handleOpenActivityFromLine = useCallback((line: NoteLine) => {
    const linkedActivity = activityByLineId.get(line.id);
    if (!linkedActivity) {
      return;
    }

    setSelectedActivityFromNote(linkedActivity);
  }, [activityByLineId]);

  const effectiveAppearance = settingsPreview?.appearance ?? appearance;
  const effectiveTags = settingsPreview?.tags ?? settings.tags;
  const effectiveCustomFields = settingsPreview?.customFields ?? settings.customFields;
  const effectiveListDisplay = settingsPreview?.listDisplay ?? settings.listDisplay;
  const effectiveSavedFilters = settingsPreview?.savedFilters ?? settings.savedFilters;
  const effectiveNoteTemplates = settingsPreview?.noteTemplates ?? settings.noteTemplates;
  const effectiveAllowReopenCompleted = settingsPreview?.allowReopenCompleted ?? settings.allowReopenCompleted;
  const effectiveAutosaveEnabled = settingsPreview?.autosaveEnabled ?? settings.autosaveEnabled;
  const effectiveNoteDateButtonsEnabled = settingsPreview?.noteDateButtonsEnabled ?? settings.noteDateButtonsEnabled;
  const effectiveQuickRescheduleDaysThreshold = settingsPreview?.quickRescheduleDaysThreshold ?? settings.quickRescheduleDaysThreshold;

  const handleCloseSettings = useCallback(() => {
    setSettingsPreview(null);
    setPreviewAppearance(null);
    setSettingsOpen(false);
  }, [setPreviewAppearance]);

  const handleSettingsPreview = useCallback((preview: SettingsPanelPreview) => {
    setSettingsPreview(preview);
    setPreviewAppearance(preview.appearance);
  }, [setPreviewAppearance]);

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
    onSelectSearchResult: handleSelectSearchResult,
    allDatesWithNotes,
    saveStatus,
    hasUnsavedChanges,
    autosaveEnabled: effectiveAutosaveEnabled,
    noteDateButtonsEnabled: effectiveNoteDateButtonsEnabled,
    quickRescheduleDaysThreshold: effectiveQuickRescheduleDaysThreshold,
    onSave: saveAllPending,
    onUndo: undo,
    onRedo: redo,
    canUndo,
    canRedo,
    activities: sortedActivities,
    tags: effectiveTags,
    customFields: effectiveCustomFields,
    listDisplay: effectiveListDisplay,
    savedFilters: effectiveSavedFilters,
    onAddActivity: addActivity,
    onUpdateActivity: updateActivity,
    onDeleteActivity: deleteActivity,
    onToggleComplete: toggleComplete,
    onReorderActivities: reorderActivities,
    onOpenSettings: () => setSettingsOpen(true),
    sortOption,
    onSortChange: setSortOption,
    allowReopenCompleted: effectiveAllowReopenCompleted,
    onCreateActivityFromLine: handleOpenDetailedActivityFormFromLine,
    onOpenDetailedActivityFromLine: handleOpenDetailedActivityFormFromLine,
    activityCreatedLineIds,
    highlightedLineIds: activeNoteSearchFlash?.date === currentNote.date ? activeNoteSearchFlash.matchedLineIds : [],
    searchFocusKey: activeNoteSearchFlash ? activeNoteSearchFlash.flashKey : null,
    noteTemplates: effectiveNoteTemplates,
  };

  const useMobileLayout = isMobile && effectiveAppearance.mobileLayoutMode === 'mobile';
  const showLayoutSelector = isMobile;

  const renderContent = () => {
    if (useMobileLayout) {
      return (
        <Suspense fallback={<SectionFallback />}>
          <MobileLayout {...commonProps} />
        </Suspense>
      );
    }

    if (isTablet || (isMobile && effectiveAppearance.mobileLayoutMode === 'desktop')) {
      return (
        <Suspense fallback={<SectionFallback />}>
          <TabletLayout {...commonProps} />
        </Suspense>
      );
    }

    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <div className="shrink-0 flex items-center justify-between border-b bg-muted/30 px-4 py-2">
          <Brand compact />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user?.username}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="h-8">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            <ResizablePanel defaultSize={65} minSize={40}>
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
                  <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
                    <Suspense fallback={<SectionFallback />}>
                      <NotesSidebar
                        dates={allDatesWithNotes}
                        currentDate={currentDate}
                        showDateButtons={effectiveNoteDateButtonsEnabled}
                        onSelectDate={handleDateChange}
                        onSearch={searchNotes}
                        onSelectSearchResult={handleSelectSearchResult}
                      />
                    </Suspense>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  <ResizablePanel defaultSize={70} minSize={40}>
                    <Suspense fallback={<SectionFallback />}>
                      <NoteEditor
                        currentDate={currentDate}
                        note={currentNote}
                        onDateChange={handleDateChange}
                        onUpdateLine={handleUpdateLine}
                        onAddLine={handleAddLine}
                        onDeleteLine={handleDeleteLine}
                        onToggleCollapse={handleToggleCollapse}
                        onUpdateIndent={handleUpdateIndent}
                        saveStatus={saveStatus}
                        hasUnsavedChanges={hasUnsavedChanges}
                        autosaveEnabled={effectiveAutosaveEnabled}
                        showDateButtons
                        onSave={saveAllPending}
                        onUndo={undo}
                        onRedo={redo}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onCreateActivityFromLine={handleOpenDetailedActivityFormFromLine}
                        onOpenDetailedActivityFromLine={handleOpenDetailedActivityFormFromLine}
                        activityCreatedLineIds={activityCreatedLineIds}
                        highlightedLineIds={activeNoteSearchFlash?.date === currentNote.date ? activeNoteSearchFlash.matchedLineIds : []}
                        searchFocusKey={activeNoteSearchFlash ? activeNoteSearchFlash.flashKey : null}
                        noteTemplates={effectiveNoteTemplates}
                      />
                    </Suspense>
                  </ResizablePanel>
                </ResizablePanelGroup>

                <Suspense fallback={null}>
                  <NoteFormattingHints />
                </Suspense>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={35} minSize={20}>
              <Suspense fallback={<SectionFallback />}>
                <ActivityList
                  currentDate={currentDate}
                  activities={sortedActivities}
                  tags={effectiveTags}
                  customFields={effectiveCustomFields}
                  listDisplay={effectiveListDisplay}
                  savedFilters={effectiveSavedFilters}
                  onAdd={addActivity}
                  onUpdate={updateActivity}
                  onDelete={deleteActivity}
                  onToggleComplete={toggleComplete}
                  onReorder={reorderActivities}
                  onOpenSettings={() => setSettingsOpen(true)}
                  sortOption={sortOption}
                  onSortChange={setSortOption}
                  allowReopenCompleted={effectiveAllowReopenCompleted}
                  showQuickRescheduleButtons={effectiveNoteDateButtonsEnabled}
                  quickRescheduleDaysThreshold={effectiveQuickRescheduleDaysThreshold}
                />
              </Suspense>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderContent()}

      {showLayoutSelector && (
        <Suspense fallback={null}>
          <LayoutModeSelector
            currentMode={effectiveAppearance.mobileLayoutMode}
            onModeChange={(mode) => updateAppearance({ mobileLayoutMode: mode })}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        {settingsOpen && (
          <SettingsPanel
            isOpen={settingsOpen}
            onClose={handleCloseSettings}
            customFields={settings.customFields}
            tags={settings.tags}
            noteTemplates={settings.noteTemplates}
            allowReopenCompleted={settings.allowReopenCompleted}
            autosaveEnabled={settings.autosaveEnabled}
            noteDateButtonsEnabled={settings.noteDateButtonsEnabled}
            quickRescheduleDaysThreshold={settings.quickRescheduleDaysThreshold}
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
            onUpdateNoteTemplates={updateNoteTemplates}
            onPreviewChange={handleSettingsPreview}
          />
        )}
      </Suspense>

      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onSave={handleSaveAndContinue}
        onDiscard={handleDiscardAndContinue}
        onCancel={handleCancelNavigation}
      />

      <Suspense fallback={null}>
        {selectedActivityFromNote && (
          <ActivityDetail
            activity={selectedActivityFromNote}
            activities={allActivities}
            tags={effectiveTags}
            customFields={effectiveCustomFields.filter((field) => field.enabled && (field.display === 'detail' || field.display === 'both'))}
            formLayout={effectiveListDisplay.formLayout}
            onSave={async (activityId, payload) => {
              updateActivity(activityId, {
                title: payload.title,
                tags: payload.tags,
                customFields: payload.customFields,
              });
              const previousCustomFields = selectedActivityFromNote.customFields;
              const relatedUpdates = buildDependencySyncUpdates({
                activities: allActivities,
                currentActivityId: activityId,
                previousCustomFields,
                nextCustomFields: payload.customFields,
              });
              relatedUpdates.forEach((update) => {
                updateActivity(update.id, { customFields: update.customFields });
              });
            }}
            onClose={() => setSelectedActivityFromNote(null)}
            isReadOnly={selectedActivityFromNote.completed}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {pendingLineToConvert && showCreateDialogFromNote && (
          <ActivityCreateDialog
            isOpen={showCreateDialogFromNote}
            onOpenChange={(open) => {
              setShowCreateDialogFromNote(open);
              if (!open) {
                setPendingLineToConvert(null);
              }
            }}
            title="Transformar nota em atividade"
            submitLabel="Criar Atividade"
            activities={allActivities}
            tags={effectiveTags}
            customFields={effectiveCustomFields}
            formLayout={effectiveListDisplay.formLayout}
            titleFieldMode="fixed-top"
            initialTitle={pendingLineInitialTitle}
            initialCustomFields={pendingLineInitialCustomFields ?? undefined}
            onSubmit={async ({ title, tags, customFields }) => {
              const createdActivity = await addActivity(title, tags.length > 0 ? tags : undefined, customFields);
              if (createdActivity) {
                const relatedUpdates = buildDependencySyncUpdates({
                  activities: [...allActivities, createdActivity],
                  currentActivityId: createdActivity.id,
                  previousCustomFields: {},
                  nextCustomFields: customFields,
                });
                relatedUpdates.forEach((update) => {
                  updateActivity(update.id, { customFields: update.customFields });
                });
              }
              setShowCreateDialogFromNote(false);
              setPendingLineToConvert(null);
            }}
          />
        )}
      </Suspense>
    </>
  );
};

export default Index;
