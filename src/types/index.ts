export type FieldType = 
  | 'text' 
  | 'long_text' 
  | 'date' 
  | 'datetime' 
  | 'number' 
  | 'currency' 
  | 'boolean' 
  | 'single_select' 
  | 'multi_select'
  | 'tags';

export type DisplayLocation = 'list' | 'detail' | 'both';

export interface FieldValidation {
  min?: number;
  max?: number;
  regex?: string;
  maxLength?: number;
}

export interface CustomField {
  id: string;
  key: string;
  name: string;
  type: FieldType;
  options?: string[];
  enabled: boolean;
  required: boolean;
  defaultValue?: string | number | boolean | null;
  validation?: FieldValidation;
  display: DisplayLocation;
  order: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface ActivitySubtask {
  id: string;
  title: string;
  completed: boolean;
}

export type RecurrenceFrequency = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface ActivityRecurrence {
  frequency: RecurrenceFrequency;
  interval?: number;
  weekdays?: number[];
  dayOfMonth?: number;
  nextDate?: string | null;
  lastGeneratedAt?: string | null;
}

export type ActivityBucket = 'inbox' | 'today' | 'upcoming' | 'someday';

export type ActivityStatus = 'open' | 'done';

export interface Activity {
  id: string;
  title: string;
  description?: string;
  status: ActivityStatus;
  completed: boolean;
  tags: string[];
  customFields: Record<string, JsonValue>;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export type LineType = 'paragraph' | 'title' | 'subtitle' | 'quote' | 'bullet' | 'comment';

export interface NoteLine {
  id: string;
  content: string;
  type: LineType;
  collapsed?: boolean;
  indent?: number;
}

export interface DailyNote {
  date: string;
  lines: NoteLine[];
  updatedAt: Date;
}

export interface NoteTemplate {
  id: string;
  name: string;
  lines: Array<Pick<NoteLine, 'content' | 'type'>>;
}

export interface NoteSearchResult {
  date: string;
  matchedLineIds: string[];
  matchedTerms: string[];
  snippet: string;
  primaryLineId: string;
  matchStart: number;
}

export type SortOption = 'manual' | 'dueDate_asc' | 'dueDate_desc' | 'priority_asc' | 'priority_desc' | 'createdAt_desc' | 'tag' | 'field';

export type ActivityCreationMode = 'simple' | 'detailed';
export type AppVisualMode = 'current' | 'new';

// Appearance settings types
export type FontFamily = 'inter' | 'system' | 'roboto' | 'opensans' | 'poppins';
export type FontSize = 'small' | 'medium' | 'large';
export type ColorTheme = 'amber' | 'blue' | 'green' | 'purple' | 'pink';
export type ThemeMode = 'light' | 'dark' | 'system';
export type NoteLineSpacing = number;

// Layout mode for mobile devices
export type MobileLayoutMode = 'mobile' | 'desktop';

export interface AppearanceSettings {
  fontFamily: FontFamily;
  fontSize: FontSize;
  colorTheme: ColorTheme;
  themeMode: ThemeMode;
  mobileLayoutMode: MobileLayoutMode;
  noteLineSpacing: NoteLineSpacing;
}

export interface ActivityFormLayoutBlock {
  id: string;
  contentKey: string;
  colStart: number;
  rowStart: number;
  colSpan: number;
  rowSpan: number;
}

export interface ActivityFormLayoutSettings {
  blocks: ActivityFormLayoutBlock[];
}

export interface LayoutSettings {
  showTabs: boolean;
  showNotes: boolean;
  showNotesList: boolean;
  showActivities: boolean;
  desktopMainPanelSize: number;
  desktopNotesListPanelSize: number;
  tabletNotesPanelSize: number;
}

// Activity list display settings
export interface ActivityListDisplaySettings {
  showTags: boolean;
  showDueDate: boolean;
  showPriority: boolean;
  visibleFieldIds: string[]; // IDs of custom fields to show in list view
  formLayout: ActivityFormLayoutSettings;
}

// Filter configuration
export interface FilterConfig {
  type: 'tag' | 'field';
  fieldId?: string; // For field filters
  tagId?: string; // For tag filters
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'isEmpty' | 'isNotEmpty';
  value?: string | number | boolean | string[];
  value2?: string | number; // For "between" operator
}

// Sort configuration
export interface SortConfig {
  type: 'manual' | 'createdAt' | 'tag' | 'field';
  fieldId?: string; // For field sorting
  tagId?: string; // For tag sorting
  direction: 'asc' | 'desc';
}

export interface AppSettings {
  customFields: CustomField[];
  tags: Tag[];
  noteTemplates: NoteTemplate[];
  appVisualMode: AppVisualMode;
  allowReopenCompleted: boolean;
  defaultSort: SortOption;
  activityCreationMode: ActivityCreationMode;
  autosaveEnabled: boolean;
  noteDateButtonsEnabled: boolean;
  quickRescheduleDaysThreshold: number;
  layout: LayoutSettings;
  listDisplay: ActivityListDisplaySettings;
  savedFilters: FilterConfig[];
  savedSort: SortConfig;
}
