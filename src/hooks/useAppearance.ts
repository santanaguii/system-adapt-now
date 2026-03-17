import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { FontFamily, FontSize, ColorTheme, ThemeMode, MobileLayoutMode, NoteLineSpacing, AppearanceSettings } from '@/types';
import { upsertUserSettings } from '@/lib/user-settings';

interface UserSettingsRow {
  font_family: string;
  font_size: string;
  color_theme: string;
  theme_mode: string;
  mobile_layout_mode?: string;
  note_line_spacing?: string;
}

interface UseAppearanceOptions {
  userId?: string;
  isAuthenticated?: boolean;
}

export const defaultAppearance: AppearanceSettings = {
  fontFamily: 'inter',
  fontSize: 'medium',
  colorTheme: 'amber',
  themeMode: 'system',
  mobileLayoutMode: 'mobile',
  noteLineSpacing: 35,
};

const fontFamilyMap: Record<FontFamily, string> = {
  inter: "'Inter', system-ui, sans-serif",
  system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  roboto: "'Roboto', system-ui, sans-serif",
  opensans: "'Open Sans', system-ui, sans-serif",
  poppins: "'Poppins', system-ui, sans-serif",
};

const fontSizeMap: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
};

const legacyNoteLineSpacingMap = {
  compact: 12,
  normal: 35,
  relaxed: 70,
} as const;

function clampNoteLineSpacing(value: number) {
  return Math.max(0, Math.min(100, value));
}

function interpolate(min: number, max: number, ratio: number) {
  return (min + (max - min) * ratio).toFixed(2);
}

function getNoteLineSpacingVars(spacing: NoteLineSpacing) {
  const ratio = clampNoteLineSpacing(spacing) / 100;

  return {
    '--note-line-height-heading': interpolate(0.92, 1.35, ratio),
    '--note-line-height-paragraph': interpolate(1.0, 1.95, ratio),
    '--note-line-height-quote': interpolate(1.02, 1.8, ratio),
    '--note-line-height-comment': interpolate(0.98, 1.6, ratio),
  };
}

function parseNoteLineSpacing(value: string | null | undefined) {
  if (!value) {
    return defaultAppearance.noteLineSpacing;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue in legacyNoteLineSpacingMap) {
    return legacyNoteLineSpacingMap[normalizedValue as keyof typeof legacyNoteLineSpacingMap];
  }

  const numericValue = Number(normalizedValue.replace(',', '.'));
  if (Number.isFinite(numericValue)) {
    return clampNoteLineSpacing(numericValue);
  }

  return defaultAppearance.noteLineSpacing;
}

// Color themes - HSL values for each theme
const colorThemes: Record<ColorTheme, { light: Record<string, string>; dark: Record<string, string> }> = {
  amber: {
    light: {
      '--primary': '35 90% 50%',
      '--primary-foreground': '40 20% 98%',
      '--accent': '35 80% 55%',
      '--accent-foreground': '40 20% 98%',
      '--ring': '35 90% 50%',
    },
    dark: {
      '--primary': '35 85% 55%',
      '--primary-foreground': '30 15% 8%',
      '--accent': '35 80% 55%',
      '--accent-foreground': '30 15% 8%',
      '--ring': '35 85% 55%',
    },
  },
  blue: {
    light: {
      '--primary': '220 90% 50%',
      '--primary-foreground': '220 20% 98%',
      '--accent': '220 80% 55%',
      '--accent-foreground': '220 20% 98%',
      '--ring': '220 90% 50%',
    },
    dark: {
      '--primary': '220 85% 60%',
      '--primary-foreground': '220 15% 8%',
      '--accent': '220 80% 55%',
      '--accent-foreground': '220 15% 8%',
      '--ring': '220 85% 60%',
    },
  },
  green: {
    light: {
      '--primary': '150 70% 40%',
      '--primary-foreground': '150 20% 98%',
      '--accent': '150 60% 45%',
      '--accent-foreground': '150 20% 98%',
      '--ring': '150 70% 40%',
    },
    dark: {
      '--primary': '150 65% 50%',
      '--primary-foreground': '150 15% 8%',
      '--accent': '150 60% 45%',
      '--accent-foreground': '150 15% 8%',
      '--ring': '150 65% 50%',
    },
  },
  purple: {
    light: {
      '--primary': '270 70% 55%',
      '--primary-foreground': '270 20% 98%',
      '--accent': '270 60% 60%',
      '--accent-foreground': '270 20% 98%',
      '--ring': '270 70% 55%',
    },
    dark: {
      '--primary': '270 65% 60%',
      '--primary-foreground': '270 15% 8%',
      '--accent': '270 60% 55%',
      '--accent-foreground': '270 15% 8%',
      '--ring': '270 65% 60%',
    },
  },
  pink: {
    light: {
      '--primary': '330 70% 55%',
      '--primary-foreground': '330 20% 98%',
      '--accent': '330 60% 60%',
      '--accent-foreground': '330 20% 98%',
      '--ring': '330 70% 55%',
    },
    dark: {
      '--primary': '330 65% 60%',
      '--primary-foreground': '330 15% 8%',
      '--accent': '330 60% 55%',
      '--accent-foreground': '330 15% 8%',
      '--ring': '330 65% 60%',
    },
  },
};

export function applyAppearanceToDocument(appearance: AppearanceSettings, resolvedTheme?: string) {
  const root = document.documentElement;

  root.style.setProperty('--font-family', fontFamilyMap[appearance.fontFamily]);
  document.body.style.fontFamily = fontFamilyMap[appearance.fontFamily];
  root.style.fontSize = fontSizeMap[appearance.fontSize];
  Object.entries(getNoteLineSpacingVars(appearance.noteLineSpacing)).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  const isDark = resolvedTheme === 'dark';
  const themeColors = colorThemes[appearance.colorTheme][isDark ? 'dark' : 'light'];

  Object.entries(themeColors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
}

export function useAppearance(options: UseAppearanceOptions = {}) {
  const { userId, isAuthenticated = false } = options;
  const { setTheme, resolvedTheme } = useTheme();
  const [appearance, setAppearance] = useState<AppearanceSettings>(defaultAppearance);
  const [previewAppearance, setPreviewAppearanceState] = useState<AppearanceSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const effectiveAppearance = previewAppearance ?? appearance;

  // Load appearance settings from database
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setAppearance(defaultAppearance);
      setIsLoading(false);
      return;
    }

    const loadAppearance = async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings' as never)
          .select('font_family, font_size, color_theme, theme_mode, mobile_layout_mode, note_line_spacing')
          .eq('user_id', userId)
          .maybeSingle() as { data: UserSettingsRow | null; error: unknown };

        if (!error && data) {
          const loaded: AppearanceSettings = {
            fontFamily: (data.font_family || 'inter') as FontFamily,
            fontSize: (data.font_size || 'medium') as FontSize,
            colorTheme: (data.color_theme || 'amber') as ColorTheme,
            themeMode: (data.theme_mode || 'system') as ThemeMode,
            mobileLayoutMode: (data.mobile_layout_mode || 'mobile') as MobileLayoutMode,
            noteLineSpacing: parseNoteLineSpacing(data.note_line_spacing),
          };
          setAppearance(loaded);
        }
      } catch (error) {
        console.error('Error loading appearance:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAppearance();
  }, [isAuthenticated, userId, setTheme]);

  // Apply appearance settings to DOM
  useEffect(() => {
    applyAppearanceToDocument(effectiveAppearance, resolvedTheme);
  }, [effectiveAppearance, resolvedTheme]);

  useEffect(() => {
    setTheme(effectiveAppearance.themeMode);
  }, [effectiveAppearance.themeMode, setTheme]);

  // Update a single setting
  const updateAppearance = useCallback(async (updates: Partial<AppearanceSettings>) => {
    const newAppearance = {
      ...appearance,
      ...updates,
      noteLineSpacing: updates.noteLineSpacing !== undefined
        ? clampNoteLineSpacing(updates.noteLineSpacing)
        : appearance.noteLineSpacing,
    };
    setAppearance(newAppearance);

    if (!userId) return;

    try {
      const dbUpdates: Record<string, string> = {};
      if (updates.fontFamily !== undefined) dbUpdates.font_family = updates.fontFamily;
      if (updates.fontSize !== undefined) dbUpdates.font_size = updates.fontSize;
      if (updates.colorTheme !== undefined) dbUpdates.color_theme = updates.colorTheme;
      if (updates.themeMode !== undefined) dbUpdates.theme_mode = updates.themeMode;
      if (updates.mobileLayoutMode !== undefined) dbUpdates.mobile_layout_mode = updates.mobileLayoutMode;
      if (updates.noteLineSpacing !== undefined) dbUpdates.note_line_spacing = String(clampNoteLineSpacing(updates.noteLineSpacing));

      const { error } = await upsertUserSettings(userId, dbUpdates);

      if (error) {
        console.error('Error saving appearance:', error);
      }
    } catch (error) {
      console.error('Error saving appearance:', error);
    }
  }, [userId, appearance]);

  const setPreviewAppearance = useCallback((nextAppearance: AppearanceSettings | null) => {
    setPreviewAppearanceState(nextAppearance ? {
      ...nextAppearance,
      noteLineSpacing: clampNoteLineSpacing(nextAppearance.noteLineSpacing),
    } : null);
  }, []);

  return {
    appearance,
    isLoading,
    updateAppearance,
    setPreviewAppearance,
  };
}
