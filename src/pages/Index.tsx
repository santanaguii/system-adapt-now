import { Suspense, lazy, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useActivities } from '@/hooks/useActivities';
import { useNotes } from '@/hooks/useNotes';
import { useSettings } from '@/hooks/useSettings';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAppearanceContext } from '@/contexts/AppearanceContext';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Brand } from '@/components/brand/Brand';
import { AppTopBar, NewVisualSection } from '@/components/layout/AppTopBar';
import { AppVisualModeSelector } from '@/components/layout/AppVisualModeSelector';
import {
  Activity,
  AppearanceSettings,
  CustomField,
  FilterConfig,
  LayoutSettings,
  LineType,
  NoteLine,
  NoteSearchResult,
  NoteTemplate,
  SortConfig,
  SortOption,
  Tag,
} from '@/types';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Loader2, LogOut, Settings, User } from 'lucide-react';
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
const NewVisualNotesWorkspace = lazy(() =>
  import('@/components/notes/NewVisualNotesWorkspace').then((module) => ({ default: module.NewVisualNotesWorkspace }))
);
const DashboardOverview = lazy(() =>
  import('@/components/dashboard/DashboardOverview').then((module) => ({ default: module.DashboardOverview }))
);
const SettingsPanel = lazy(() =>
  import('@/components/settings/SettingsPanel').then((module) => ({ default: module.SettingsPanel }))
);
type SettingsPanelPreview = import('@/components/settings/SettingsPanel').SettingsPanelPreview;
const NewVisualSettingsDialog = lazy(() =>
  import('@/components/settings/NewVisualSettingsDialog').then((module) => ({ default: module.NewVisualSettingsDialog }))
);
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
  appVisualMode: import('@/types').AppVisualMode;
  allowReopenCompleted: boolean;
  defaultSort: SortOption;
  autosaveEnabled: boolean;
  noteDateButtonsEnabled: boolean;
  quickRescheduleDaysThreshold: number;
  appearance: AppearanceSettings;
  layout: LayoutSettings;
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
  const { appearance, isLoading: appearanceIsLoading, updateAppearance, setPreviewAppearance } = useAppearanceContext();
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newVisualSettingsOpen, setNewVisualSettingsOpen] = useState(false);
  const [settingsPreview, setSettingsPreview] = useState<SettingsPreviewState | null>(null);
  const [newVisualSection, setNewVisualSection] = useState<NewVisualSection>('dashboard');
  const [sortOverride, setSortOverride] = useState<SortOption | null>(null);
  const [pendingLineToConvert, setPendingLineToConvert] = useState<NoteLine | null>(null);
  const [showCreateDialogFromNote, setShowCreateDialogFromNote] = useState(false);
  const [showCreateDialogFromDashboard, setShowCreateDialogFromDashboard] = useState(false);
  const [selectedActivityFromNote, setSelectedActivityFromNote] = useState<Activity | null>(null);
  const [activeNoteSearchFlash, setActiveNoteSearchFlash] = useState<(NoteSearchResult & { flashKey: string }) | null>(null);
  const [pendingSearchSelection, setPendingSearchSelection] = useState<NoteSearchResult | null>(null);
  const searchFlashTimeoutRef = useRef<number | null>(null);
  const layoutSaveTimeoutRef = useRef<number | null>(null);
  const pendingLayoutUpdatesRef = useRef<Partial<LayoutSettings>>({});

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isTablet = windowWidth > MOBILE_MAX && windowWidth <= TABLET_MAX;
  const isMobile = windowWidth <= MOBILE_MAX;

  const {
    settings,
    isLoading: settingsIsLoading,
    addCustomField,
    updateCustomField,
    deleteCustomField,
    addTag,
    updateTag,
    deleteTag,
    updateGeneralSettings,
    updateLayoutSettings,
    updateListDisplay,
    updateSavedFilters,
    updateNoteTemplates,
  } = useSettings();
  const effectiveDefaultSort = settingsPreview?.defaultSort ?? settings.defaultSort;
  const effectiveSortOption = settingsPreview?.defaultSort ?? sortOverride ?? settings.defaultSort;

  const {
    activities,
    sortedActivities,
    addActivity,
    updateActivity,
    deleteActivity,
    toggleComplete,
    reorderActivities,
  } = useActivities(effectiveSortOption, settings.customFields);

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
    replaceNoteRichContent,
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

  const [pendingSectionChange, setPendingSectionChange] = useState<NewVisualSection | null>(null);

  const handleSectionChange = useCallback((newSection: NewVisualSection) => {
    if (newSection === newVisualSection) {
      return;
    }

    if (hasUnsavedChanges && !settings.autosaveEnabled) {
      setPendingSectionChange(newSection);
      setShowUnsavedDialog(true);
    } else {
      setNewVisualSection(newSection);
    }
  }, [newVisualSection, hasUnsavedChanges, settings.autosaveEnabled]);

  const handleSaveAndContinue = useCallback(async () => {
    const didSave = await saveAllPending();
    if (!didSave) {
      return;
    }
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
    if (pendingSectionChange) {
      setNewVisualSection(pendingSectionChange);
      setPendingSectionChange(null);
    }
    setShowUnsavedDialog(false);
  }, [applySearchSelection, clearSearchFlash, pendingDateChange, pendingSearchSelection, pendingSectionChange, saveAllPending]);

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
    if (pendingSectionChange) {
      setNewVisualSection(pendingSectionChange);
      setPendingSectionChange(null);
    }
    setShowUnsavedDialog(false);
  }, [applySearchSelection, clearSearchFlash, discardChanges, pendingDateChange, pendingSearchSelection, pendingSectionChange]);

  const handleCancelNavigation = useCallback(() => {
    setPendingDateChange(null);
    setPendingSearchSelection(null);
    setPendingSectionChange(null);
    setShowUnsavedDialog(false);
  }, []);

  useEffect(() => {
    return () => {
      if (searchFlashTimeoutRef.current !== null) {
        window.clearTimeout(searchFlashTimeoutRef.current);
      }
      if (layoutSaveTimeoutRef.current !== null) {
        window.clearTimeout(layoutSaveTimeoutRef.current);
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
  const effectiveAppVisualMode = settingsPreview?.appVisualMode ?? settings.appVisualMode;
  const effectiveTags = settingsPreview?.tags ?? settings.tags;
  const effectiveCustomFields = settingsPreview?.customFields ?? settings.customFields;
  const effectiveLayout = settingsPreview?.layout ?? settings.layout;
  const effectiveListDisplay = settingsPreview?.listDisplay ?? settings.listDisplay;
  const effectiveSavedFilters = settingsPreview?.savedFilters ?? settings.savedFilters;
  const effectiveNoteTemplates = settingsPreview?.noteTemplates ?? settings.noteTemplates;
  const effectiveAllowReopenCompleted = settingsPreview?.allowReopenCompleted ?? settings.allowReopenCompleted;
  const effectiveAutosaveEnabled = settingsPreview?.autosaveEnabled ?? settings.autosaveEnabled;
  const effectiveNoteDateButtonsEnabled = settingsPreview?.noteDateButtonsEnabled ?? settings.noteDateButtonsEnabled;
  const effectiveQuickRescheduleDaysThreshold = settingsPreview?.quickRescheduleDaysThreshold ?? settings.quickRescheduleDaysThreshold;

  const handleSortChange = useCallback((nextSort: SortOption) => {
    setSortOverride(nextSort === effectiveDefaultSort ? null : nextSort);
  }, [effectiveDefaultSort]);

  const handleCloseSettings = useCallback(() => {
    setSettingsPreview(null);
    setPreviewAppearance(null);
    setSettingsOpen(false);
  }, [setPreviewAppearance]);

  const handleSettingsPreview = useCallback((preview: SettingsPanelPreview) => {
    setSettingsPreview(preview);
    setPreviewAppearance(preview.appearance);
  }, [setPreviewAppearance]);

  const scheduleLayoutSettingsUpdate = useCallback((updates: Partial<LayoutSettings>) => {
    pendingLayoutUpdatesRef.current = {
      ...pendingLayoutUpdatesRef.current,
      ...updates,
    };

    if (layoutSaveTimeoutRef.current !== null) {
      window.clearTimeout(layoutSaveTimeoutRef.current);
    }

    layoutSaveTimeoutRef.current = window.setTimeout(() => {
      const nextUpdates = pendingLayoutUpdatesRef.current;
      pendingLayoutUpdatesRef.current = {};
      layoutSaveTimeoutRef.current = null;
      void updateLayoutSettings(nextUpdates);
    }, 250);
  }, [updateLayoutSettings]);

  const handleAppVisualModeChange = useCallback((mode: import('@/types').AppVisualMode) => {
    if (mode === 'new') {
      setNewVisualSection('dashboard');
    }
    void updateGeneralSettings({ appVisualMode: mode });
  }, [updateGeneralSettings]);

  const commonProps = {
    username: user?.username || '',
    onSignOut: signOut,
    appVisualMode: effectiveAppVisualMode,
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
    layout: effectiveLayout,
    onUpdateLayoutSettings: scheduleLayoutSettingsUpdate,
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
    onAppVisualModeChange: handleAppVisualModeChange,
    sortOption: effectiveSortOption,
    onSortChange: handleSortChange,
    allowReopenCompleted: effectiveAllowReopenCompleted,
    onCreateActivityFromLine: handleOpenDetailedActivityFormFromLine,
    onOpenDetailedActivityFromLine: handleOpenDetailedActivityFormFromLine,
    activityCreatedLineIds,
    highlightedLineIds: activeNoteSearchFlash?.date === currentNote.date ? activeNoteSearchFlash.matchedLineIds : [],
    searchFocusKey: activeNoteSearchFlash ? activeNoteSearchFlash.flashKey : null,
    noteTemplates: effectiveNoteTemplates,
  };

  const useMobileLayout = isMobile && effectiveAppearance.mobileLayoutMode === 'mobile';
  const showLayoutSelector = isMobile && effectiveAppVisualMode !== 'new';

  const renderContent = () => {
    if (appearanceIsLoading || settingsIsLoading) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }

    if (effectiveAppVisualMode === 'new') {
      return (
        <div className="flex h-screen flex-col overflow-hidden bg-background">
          <AppTopBar
            username={user?.username || ''}
            onOpenSettings={() => setNewVisualSettingsOpen(true)}
            onSignOut={signOut}
            selectedSection={newVisualSection}
            onSectionChange={handleSectionChange}
            toolbarSlot={<AppVisualModeSelector value={effectiveAppVisualMode} onChange={handleAppVisualModeChange} />}
            className="shrink-0"
          />
          {newVisualSection === 'dashboard' ? (
            <Suspense fallback={<SectionFallback />}>
              <DashboardOverview
                currentDate={currentDate}
                note={currentNote}
                activities={sortedActivities}
                tags={effectiveTags}
                autosaveEnabled={effectiveAutosaveEnabled}
                hasUnsavedChanges={hasUnsavedChanges}
                saveStatus={saveStatus}
                noteTemplates={effectiveNoteTemplates}
                onOpenSection={handleSectionChange}
                onReplaceNoteContent={replaceNoteRichContent}
                onCreateActivity={() => setShowCreateDialogFromDashboard(true)}
                onToggleComplete={toggleComplete}
                onOpenActivity={setSelectedActivityFromNote}
                onSaveNote={saveAllPending}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            </Suspense>
          ) : newVisualSection === 'notes' ? (
            <Suspense fallback={<SectionFallback />}>
              <NewVisualNotesWorkspace
                key={currentNote.date}
                currentDate={currentDate}
                note={currentNote}
                allDatesWithNotes={allDatesWithNotes}
                onDateChange={handleDateChange}
                onSearch={searchNotes}
                onSelectSearchResult={handleSelectSearchResult}
                onReplaceContent={replaceNoteRichContent}
                onSave={saveAllPending}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                autosaveEnabled={effectiveAutosaveEnabled}
                hasUnsavedChanges={hasUnsavedChanges}
                saveStatus={saveStatus}
                noteTemplates={effectiveNoteTemplates}
              />
            </Suspense>
          ) : (
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
                onUpdateListDisplay={updateListDisplay}
                sortOption={effectiveSortOption}
                onSortChange={handleSortChange}
                allowReopenCompleted={effectiveAllowReopenCompleted}
                showQuickRescheduleButtons={effectiveNoteDateButtonsEnabled}
                quickRescheduleDaysThreshold={effectiveQuickRescheduleDaysThreshold}
              />
            </Suspense>
          )}
        </div>
      );
    }

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

    const showDesktopWorkspace = effectiveLayout.showNotes || effectiveLayout.showNotesList;
    const showDesktopActivities = effectiveLayout.showActivities;

    const desktopWorkspace = (() => {
      if (effectiveLayout.showNotesList && effectiveLayout.showNotes) {
        return (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <ResizablePanelGroup
              direction="horizontal"
              className="min-h-0 flex-1"
              onLayout={(sizes) => {
                if (sizes.length === 2) {
                  scheduleLayoutSettingsUpdate({ desktopNotesListPanelSize: sizes[0] });
                }
              }}
            >
              <ResizablePanel defaultSize={effectiveLayout.desktopNotesListPanelSize} minSize={20} maxSize={45}>
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

              <ResizablePanel defaultSize={100 - effectiveLayout.desktopNotesListPanelSize} minSize={40}>
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
        );
      }

      if (effectiveLayout.showNotesList) {
        return (
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
        );
      }

      return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
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

          <Suspense fallback={null}>
            <NoteFormattingHints />
          </Suspense>
        </div>
      );
    })();

    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <div className="shrink-0 flex items-center justify-between border-b bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-3">
            <Brand compact />
            <AppVisualModeSelector value={effectiveAppVisualMode} onChange={handleAppVisualModeChange} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user?.username}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="h-8">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex flex-1 overflow-hidden">
          {showDesktopWorkspace && showDesktopActivities ? (
            <ResizablePanelGroup
              direction="horizontal"
              className="flex-1"
              onLayout={(sizes) => {
                if (sizes.length === 2) {
                  scheduleLayoutSettingsUpdate({ desktopMainPanelSize: sizes[0] });
                }
              }}
            >
              <ResizablePanel defaultSize={effectiveLayout.desktopMainPanelSize} minSize={40}>
                {desktopWorkspace}
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={100 - effectiveLayout.desktopMainPanelSize} minSize={20}>
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
                    sortOption={effectiveSortOption}
                    onSortChange={handleSortChange}
                    allowReopenCompleted={effectiveAllowReopenCompleted}
                    showQuickRescheduleButtons={effectiveNoteDateButtonsEnabled}
                    quickRescheduleDaysThreshold={effectiveQuickRescheduleDaysThreshold}
                    visualVariant="legacy"
                  />
                </Suspense>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : showDesktopWorkspace ? (
            <div className="flex-1">{desktopWorkspace}</div>
          ) : (
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
                sortOption={effectiveSortOption}
                onSortChange={handleSortChange}
                allowReopenCompleted={effectiveAllowReopenCompleted}
                showQuickRescheduleButtons={effectiveNoteDateButtonsEnabled}
                quickRescheduleDaysThreshold={effectiveQuickRescheduleDaysThreshold}
                visualVariant="legacy"
              />
            </Suspense>
          )}
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
        {newVisualSettingsOpen && (
          <NewVisualSettingsDialog
            isOpen={newVisualSettingsOpen}
            onClose={() => setNewVisualSettingsOpen(false)}
            customFields={settings.customFields}
            tags={settings.tags}
            listDisplay={settings.listDisplay}
            onAddField={addCustomField}
            onUpdateField={updateCustomField}
            onDeleteField={deleteCustomField}
            onAddTag={addTag}
            onUpdateTag={updateTag}
            onDeleteTag={deleteTag}
            onUpdateListDisplay={updateListDisplay}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {settingsOpen && (
          <SettingsPanel
            isOpen={settingsOpen}
            onClose={handleCloseSettings}
            customFields={settings.customFields}
            tags={settings.tags}
            noteTemplates={settings.noteTemplates}
            appVisualMode={settings.appVisualMode}
            allowReopenCompleted={settings.allowReopenCompleted}
            defaultSort={settings.defaultSort}
            autosaveEnabled={settings.autosaveEnabled}
            noteDateButtonsEnabled={settings.noteDateButtonsEnabled}
            quickRescheduleDaysThreshold={settings.quickRescheduleDaysThreshold}
            appearance={appearance}
            layout={settings.layout}
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
            onUpdateLayoutSettings={updateLayoutSettings}
            onUpdateListDisplay={updateListDisplay}
            onUpdateFilters={updateSavedFilters}
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
        {showCreateDialogFromDashboard && (
          <ActivityCreateDialog
            isOpen={showCreateDialogFromDashboard}
            onOpenChange={setShowCreateDialogFromDashboard}
            title="Nova atividade"
            submitLabel="Criar Atividade"
            activities={allActivities}
            tags={effectiveTags}
            customFields={effectiveCustomFields}
            formLayout={effectiveListDisplay.formLayout}
            titleFieldMode="fixed-top"
            onSubmit={async ({ title, tags, customFields }) => {
              await addActivity(title, tags.length > 0 ? tags : undefined, customFields);
              setShowCreateDialogFromDashboard(false);
            }}
          />
        )}
      </Suspense>

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
