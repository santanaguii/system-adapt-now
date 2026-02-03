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

export type ActivityStatus = 'open' | 'done';

export interface Activity {
  id: string;
  title: string;
  description?: string;
  status: ActivityStatus;
  completed: boolean;
  tags: string[];
  customFields: Record<string, string | number | boolean | Date | string[] | null>;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export type LineType = 'paragraph' | 'title' | 'subtitle' | 'quote' | 'bullet';

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

export type SortOption = 'manual' | 'dueDate_asc' | 'dueDate_desc' | 'priority_asc' | 'priority_desc' | 'createdAt_desc' | 'tag' | 'field';

export type ActivityCreationMode = 'simple' | 'detailed';

// Appearance settings types
export type FontFamily = 'inter' | 'system' | 'roboto' | 'opensans' | 'poppins';
export type FontSize = 'small' | 'medium' | 'large';
export type ColorTheme = 'amber' | 'blue' | 'green' | 'purple' | 'pink';
export type ThemeMode = 'light' | 'dark' | 'system';

// Layout mode for mobile devices
export type MobileLayoutMode = 'mobile' | 'desktop';

export interface AppearanceSettings {
  fontFamily: FontFamily;
  fontSize: FontSize;
  colorTheme: ColorTheme;
  themeMode: ThemeMode;
  mobileLayoutMode: MobileLayoutMode;
}

// Activity list display settings
export interface ActivityListDisplaySettings {
  showTags: boolean;
  showDueDate: boolean;
  showPriority: boolean;
  visibleFieldIds: string[]; // IDs of custom fields to show in list view
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
  allowReopenCompleted: boolean;
  defaultSort: SortOption;
  activityCreationMode: ActivityCreationMode;
  autosaveEnabled: boolean;
  listDisplay: ActivityListDisplaySettings;
  savedFilters: FilterConfig[];
  savedSort: SortConfig;
}
