import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { FontFamily, FontSize, ColorTheme, ThemeMode, AppearanceSettings } from '@/types';

interface UserSettingsRow {
  font_family: string;
  font_size: string;
  color_theme: string;
  theme_mode: string;
}

interface UseAppearanceOptions {
  userId?: string;
  isAuthenticated?: boolean;
}

const defaultAppearance: AppearanceSettings = {
  fontFamily: 'inter',
  fontSize: 'medium',
  colorTheme: 'amber',
  themeMode: 'system',
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

export function useAppearance(options: UseAppearanceOptions = {}) {
  const { userId, isAuthenticated = false } = options;
  const { setTheme, resolvedTheme } = useTheme();
  const [appearance, setAppearance] = useState<AppearanceSettings>(defaultAppearance);
  const [isLoading, setIsLoading] = useState(true);

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
          .select('font_family, font_size, color_theme, theme_mode')
          .eq('user_id', userId)
          .maybeSingle() as { data: UserSettingsRow | null; error: unknown };

        if (!error && data) {
          const loaded: AppearanceSettings = {
            fontFamily: (data.font_family || 'inter') as FontFamily,
            fontSize: (data.font_size || 'medium') as FontSize,
            colorTheme: (data.color_theme || 'amber') as ColorTheme,
            themeMode: (data.theme_mode || 'system') as ThemeMode,
          };
          setAppearance(loaded);
          setTheme(loaded.themeMode);
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
    const root = document.documentElement;
    
    // Apply font family
    root.style.setProperty('--font-family', fontFamilyMap[appearance.fontFamily]);
    document.body.style.fontFamily = fontFamilyMap[appearance.fontFamily];
    
    // Apply font size
    root.style.fontSize = fontSizeMap[appearance.fontSize];
    
    // Apply color theme based on current resolved theme (light/dark)
    const isDark = resolvedTheme === 'dark';
    const themeColors = colorThemes[appearance.colorTheme][isDark ? 'dark' : 'light'];
    
    Object.entries(themeColors).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }, [appearance, resolvedTheme]);

  // Update a single setting
  const updateAppearance = useCallback(async (updates: Partial<AppearanceSettings>) => {
    const newAppearance = { ...appearance, ...updates };
    setAppearance(newAppearance);

    // Sync theme mode with next-themes
    if (updates.themeMode) {
      setTheme(updates.themeMode);
    }

    if (!userId) return;

    try {
      const dbUpdates: Record<string, string> = {};
      if (updates.fontFamily !== undefined) dbUpdates.font_family = updates.fontFamily;
      if (updates.fontSize !== undefined) dbUpdates.font_size = updates.fontSize;
      if (updates.colorTheme !== undefined) dbUpdates.color_theme = updates.colorTheme;
      if (updates.themeMode !== undefined) dbUpdates.theme_mode = updates.themeMode;

      await supabase
        .from('user_settings' as never)
        .update(dbUpdates as never)
        .eq('user_id', userId);
    } catch (error) {
      console.error('Error saving appearance:', error);
    }
  }, [userId, appearance, setTheme]);

  return {
    appearance,
    isLoading,
    updateAppearance,
  };
}
