import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { FontFamily, FontSize, ColorTheme, ThemeMode, MobileLayoutMode, NoteLineSpacing, AppearanceSettings, AppVisualMode } from '@/types';
import { upsertUserSettings } from '@/lib/user-settings';
import { toast } from '@/components/ui/sonner';

interface UserSettingsRow {
  font_family: string;
  font_size: string;
  color_theme: string;
  theme_mode: string;
  mobile_layout_mode?: string;
  note_line_spacing?: string;
  font_family_new?: string;
  font_size_new?: string;
  color_theme_new?: string;
  theme_mode_new?: string;
  mobile_layout_mode_new?: string;
  note_line_spacing_new?: string;
}

interface UseAppearanceOptions {
  userId?: string;
  isAuthenticated?: boolean;
  appVisualMode?: AppVisualMode;
}

export const defaultAppearance: AppearanceSettings = {
  fontFamily: 'inter',
  fontSize: 'medium',
  colorTheme: 'amber',
  themeMode: 'system',
  mobileLayoutMode: 'mobile',
  noteLineSpacing: 35,
};

const APPEARANCE_FALLBACK_KEY = 'appearance-settings';

function getAppearanceFallbackKey(userId: string, appVisualMode: AppVisualMode) {
  return `${APPEARANCE_FALLBACK_KEY}:${userId}:${appVisualMode}`;
}

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

const validFontFamilies = new Set<FontFamily>(['inter', 'system', 'roboto', 'opensans', 'poppins']);
const validFontSizes = new Set<FontSize>(['small', 'medium', 'large']);
const validColorThemes = new Set<ColorTheme>(['amber', 'blue', 'green', 'purple', 'pink']);
const validThemeModes = new Set<ThemeMode>(['light', 'dark', 'system']);
const validMobileLayoutModes = new Set<MobileLayoutMode>(['mobile', 'desktop']);

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

function normalizeAppearanceFallback(value: unknown): AppearanceSettings | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  return {
    fontFamily: validFontFamilies.has(candidate.fontFamily as FontFamily)
      ? candidate.fontFamily as FontFamily
      : defaultAppearance.fontFamily,
    fontSize: validFontSizes.has(candidate.fontSize as FontSize)
      ? candidate.fontSize as FontSize
      : defaultAppearance.fontSize,
    colorTheme: validColorThemes.has(candidate.colorTheme as ColorTheme)
      ? candidate.colorTheme as ColorTheme
      : defaultAppearance.colorTheme,
    themeMode: validThemeModes.has(candidate.themeMode as ThemeMode)
      ? candidate.themeMode as ThemeMode
      : defaultAppearance.themeMode,
    mobileLayoutMode: validMobileLayoutModes.has(candidate.mobileLayoutMode as MobileLayoutMode)
      ? candidate.mobileLayoutMode as MobileLayoutMode
      : defaultAppearance.mobileLayoutMode,
    noteLineSpacing: clampNoteLineSpacing(
      typeof candidate.noteLineSpacing === 'number'
        ? candidate.noteLineSpacing
        : defaultAppearance.noteLineSpacing
    ),
  };
}

function readAppearanceFallback(userId?: string, appVisualMode?: AppVisualMode) {
  if (!userId || !appVisualMode) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getAppearanceFallbackKey(userId, appVisualMode));
    return raw ? normalizeAppearanceFallback(JSON.parse(raw)) : null;
  } catch (error) {
    console.error('Error reading appearance fallback:', error);
    return null;
  }
}

function writeAppearanceFallback(userId: string, appearance: AppearanceSettings, appVisualMode: AppVisualMode) {
  try {
    window.localStorage.setItem(getAppearanceFallbackKey(userId, appVisualMode), JSON.stringify({
      ...appearance,
      noteLineSpacing: clampNoteLineSpacing(appearance.noteLineSpacing),
    }));
  } catch (error) {
    console.error('Error writing appearance fallback:', error);
  }
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
  const { userId, isAuthenticated = false, appVisualMode = 'current' } = options;
  const { setTheme, resolvedTheme } = useTheme();
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => {
    if (typeof window === 'undefined' || !isAuthenticated || !userId) {
      return defaultAppearance;
    }

    return readAppearanceFallback(userId, appVisualMode) ?? defaultAppearance;
  });
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
      const appearanceFallback = readAppearanceFallback(userId, appVisualMode);
      try {
        const { data, error } = await supabase
          .from('user_settings' as never)
          .select('*')
          .eq('user_id', userId)
          .maybeSingle() as { data: UserSettingsRow | null; error: unknown };

        if (!error && data) {
          const isNewMode = appVisualMode === 'new';
          const fontFamilyKey = isNewMode ? 'font_family_new' : 'font_family';
          const fontSizeKey = isNewMode ? 'font_size_new' : 'font_size';
          const colorThemeKey = isNewMode ? 'color_theme_new' : 'color_theme';
          const themeModeKey = isNewMode ? 'theme_mode_new' : 'theme_mode';
          const mobileLayoutModeKey = isNewMode ? 'mobile_layout_mode_new' : 'mobile_layout_mode';
          const noteLineSpacingKey = isNewMode ? 'note_line_spacing_new' : 'note_line_spacing';

          const loaded: AppearanceSettings = {
            fontFamily: validFontFamilies.has(data[fontFamilyKey] as FontFamily)
              ? data[fontFamilyKey] as FontFamily
              : (isNewMode && data.font_family ? data.font_family as FontFamily : (appearanceFallback?.fontFamily ?? defaultAppearance.fontFamily)),
            fontSize: validFontSizes.has(data[fontSizeKey] as FontSize)
              ? data[fontSizeKey] as FontSize
              : (isNewMode && data.font_size ? data.font_size as FontSize : (appearanceFallback?.fontSize ?? defaultAppearance.fontSize)),
            colorTheme: validColorThemes.has(data[colorThemeKey] as ColorTheme)
              ? data[colorThemeKey] as ColorTheme
              : (isNewMode && data.color_theme ? data.color_theme as ColorTheme : (appearanceFallback?.colorTheme ?? defaultAppearance.colorTheme)),
            themeMode: validThemeModes.has(data[themeModeKey] as ThemeMode)
              ? data[themeModeKey] as ThemeMode
              : (isNewMode && data.theme_mode ? data.theme_mode as ThemeMode : (appearanceFallback?.themeMode ?? defaultAppearance.themeMode)),
            mobileLayoutMode: validMobileLayoutModes.has(data[mobileLayoutModeKey] as MobileLayoutMode)
              ? data[mobileLayoutModeKey] as MobileLayoutMode
              : (isNewMode && data.mobile_layout_mode ? data.mobile_layout_mode as MobileLayoutMode : (appearanceFallback?.mobileLayoutMode ?? defaultAppearance.mobileLayoutMode)),
            noteLineSpacing: data[noteLineSpacingKey] == null
              ? (isNewMode && data.note_line_spacing != null ? parseNoteLineSpacing(data.note_line_spacing) : (appearanceFallback?.noteLineSpacing ?? defaultAppearance.noteLineSpacing))
              : parseNoteLineSpacing(data[noteLineSpacingKey]),
          };
          writeAppearanceFallback(userId, loaded, appVisualMode);
          setAppearance(loaded);
        } else {
          setAppearance(appearanceFallback ?? defaultAppearance);
        }
      } catch (error) {
        console.error('Error loading appearance:', error);
        setAppearance(appearanceFallback ?? defaultAppearance);
      } finally {
        setIsLoading(false);
      }
    };

    loadAppearance();
  }, [isAuthenticated, userId, appVisualMode, setTheme]);

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
    writeAppearanceFallback(userId, newAppearance, appVisualMode);

    try {
      const isNewMode = appVisualMode === 'new';
      const dbUpdates: Record<string, string> = {};
      if (updates.fontFamily !== undefined) dbUpdates[isNewMode ? 'font_family_new' : 'font_family'] = updates.fontFamily;
      if (updates.fontSize !== undefined) dbUpdates[isNewMode ? 'font_size_new' : 'font_size'] = updates.fontSize;
      if (updates.colorTheme !== undefined) dbUpdates[isNewMode ? 'color_theme_new' : 'color_theme'] = updates.colorTheme;
      if (updates.themeMode !== undefined) dbUpdates[isNewMode ? 'theme_mode_new' : 'theme_mode'] = updates.themeMode;
      if (updates.mobileLayoutMode !== undefined) dbUpdates[isNewMode ? 'mobile_layout_mode_new' : 'mobile_layout_mode'] = updates.mobileLayoutMode;
      if (updates.noteLineSpacing !== undefined) dbUpdates[isNewMode ? 'note_line_spacing_new' : 'note_line_spacing'] = String(clampNoteLineSpacing(updates.noteLineSpacing));

      const { error } = await upsertUserSettings(userId, dbUpdates);

      if (error) {
        console.error('Error saving appearance:', error);
        throw new Error('Nao foi possivel salvar a aparencia no servidor. O valor foi mantido localmente.');
      }
    } catch (error) {
      console.error('Error saving appearance:', error);
      toast.error('Nao foi possivel salvar a aparencia no servidor. O valor foi mantido localmente.');
      throw error;
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
