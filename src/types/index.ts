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

export type SortOption = 'manual' | 'dueDate_asc' | 'dueDate_desc' | 'priority_asc' | 'priority_desc' | 'createdAt_desc';

export type ActivityCreationMode = 'simple' | 'detailed';

export interface AppSettings {
  customFields: CustomField[];
  tags: Tag[];
  allowReopenCompleted: boolean;
  defaultSort: SortOption;
  activityCreationMode: ActivityCreationMode;
}
