// Auth Context - handles user authentication state
import { createContext, useContext, ReactNode } from 'react';
import { useAuth, User } from '@/hooks/useAuth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (username: string, password: string, securityQuestion: string, securityAnswer: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
  getSecurityQuestion: (username: string) => Promise<string | null>;
  verifySecurityAnswer: (username: string, answer: string) => Promise<boolean>;
  resetPassword: (username: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
