import { createContext, useContext, ReactNode } from 'react';
import { useAppearance } from '@/hooks/useAppearance';
import { useAuthContext } from '@/contexts/AuthContext';
import { AppearanceSettings } from '@/types';

interface AppearanceContextType {
  appearance: AppearanceSettings;
  isLoading: boolean;
  updateAppearance: (updates: Partial<AppearanceSettings>) => Promise<void>;
  setPreviewAppearance: (appearance: AppearanceSettings | null) => void;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuthContext();
  const appearanceHook = useAppearance({
    userId: user?.id,
    isAuthenticated,
  });

  return (
    <AppearanceContext.Provider value={appearanceHook}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearanceContext() {
  const context = useContext(AppearanceContext);
  if (context === undefined) {
    throw new Error('useAppearanceContext must be used within an AppearanceProvider');
  }
  return context;
}
