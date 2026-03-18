import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { buildDefaultUserSettings } from '@/lib/user-settings';

export interface User {
  id: string;
  username: string;
  createdAt: Date;
}

// Simple hash function for security answer (same as before)
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Convert username to internal email
function usernameToEmail(username: string): string {
  return `${username.toLowerCase().trim()}@app.internal`;
}

export const SECURITY_QUESTIONS = [
  'Qual o nome do seu primeiro animal de estimação?',
  'Qual o nome da sua mãe?',
  'Em qual cidade você nasceu?',
  'Qual o nome da sua escola primária?',
  'Qual era sua comida favorita na infância?',
];

// Default tags for new users
const DEFAULT_TAGS = [
  { name: 'Trabalho', color: 'hsl(35, 80%, 50%)' },
  { name: 'Pessoal', color: 'hsl(200, 70%, 50%)' },
  { name: 'Urgente', color: 'hsl(0, 70%, 55%)' },
];

// Default custom fields for new users
const DEFAULT_CUSTOM_FIELDS = [
  { 
    key: 'dueDate',
    name: 'Prazo', 
    field_type: 'date', 
    enabled: true,
    required: false,
    display: 'both',
    sort_order: 0
  },
  { 
    key: 'priority',
    name: 'Prioridade', 
    field_type: 'single_select', 
    options: ['Baixa', 'Média', 'Alta'], 
    enabled: true,
    required: false,
    display: 'both',
    sort_order: 1
  },
  {
    key: 'description',
    name: 'Descrição',
    field_type: 'long_text',
    enabled: true,
    required: false,
    display: 'detail',
    sort_order: 2
  },
];

const ACTIVE_DEFAULT_CUSTOM_FIELDS = DEFAULT_CUSTOM_FIELDS.filter((field) => field.key !== 'description');

// Type definitions for external Supabase tables
interface Profile {
  id: string;
  username: string;
  security_question: string;
  security_answer_hash: string;
  created_at: string;
  updated_at: string;
}

interface TagRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

interface CustomFieldRow {
  id: string;
  user_id: string;
  key: string;
  name: string;
  field_type: string;
  options: string[] | null;
  enabled: boolean;
  required: boolean;
  default_value: unknown;
  validation: unknown;
  display: string;
  sort_order: number;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const ensuredUserIdsRef = useRef(new Set<string>());
  const ensureDefaultDataPromisesRef = useRef(new Map<string, Promise<void>>());

  const ensureDefaultData = useCallback(async (userId: string) => {
    if (ensuredUserIdsRef.current.has(userId)) {
      return;
    }

    const existingPromise = ensureDefaultDataPromisesRef.current.get(userId);
    if (existingPromise) {
      await existingPromise;
      return;
    }

    const promise = (async () => {
      try {
        const [
          { data: existingTags, error: tagsError },
          { data: existingFields, error: fieldsError },
          { data: existingSettings, error: settingsError },
        ] = await Promise.all([
          supabase
            .from('tags' as never)
            .select('name')
            .eq('user_id', userId) as Promise<{ data: Pick<TagRow, 'name'>[] | null; error: unknown }>,
          supabase
            .from('custom_fields' as never)
            .select('key')
            .eq('user_id', userId) as Promise<{ data: Pick<CustomFieldRow, 'key'>[] | null; error: unknown }>,
          supabase
            .from('user_settings' as never)
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle() as Promise<{ data: Pick<{ user_id: string }, 'user_id'> | null; error: unknown }>,
        ]);

        if (tagsError) {
          console.error('Error checking default tags:', tagsError);
        } else if (!existingTags || existingTags.length === 0) {
          const tagsToInsert = DEFAULT_TAGS.map((tag) => ({
            user_id: userId,
            name: tag.name,
            color: tag.color,
          }));
          const { error } = await supabase.from('tags' as never).insert(tagsToInsert as never);
          if (error) {
            console.error('Error creating default tags:', error);
          }
        }

        if (fieldsError) {
          console.error('Error checking default custom fields:', fieldsError);
        } else {
          const existingKeys = new Set((existingFields || []).map((field) => field.key));
          const fieldsToInsert = ACTIVE_DEFAULT_CUSTOM_FIELDS
            .filter((field) => !existingKeys.has(field.key))
            .map((field) => ({
              user_id: userId,
              ...field,
            }));

          if (fieldsToInsert.length > 0) {
            const { error } = await supabase.from('custom_fields' as never).insert(fieldsToInsert as never);
            if (error) {
              console.error('Error creating default custom fields:', error);
            }
          }
        }

        if (settingsError) {
          console.error('Error checking user settings:', settingsError);
        } else if (!existingSettings) {
          const { error } = await supabase
            .from('user_settings' as never)
            .insert(buildDefaultUserSettings(userId) as never);
          if (error) {
            console.error('Error creating default user settings:', error);
          }
        }

        ensuredUserIdsRef.current.add(userId);
      } catch (error) {
        console.error('Error ensuring default data:', error);
      } finally {
        ensureDefaultDataPromisesRef.current.delete(userId);
      }
    })();

    ensureDefaultDataPromisesRef.current.set(userId, promise);
    await promise;
  }, []);

  // Load user profile from database
  const loadUserProfile = useCallback(async (supabaseUser: SupabaseUser) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles' as never)
        .select('username, created_at')
        .eq('id', supabaseUser.id)
        .maybeSingle() as { data: Pick<Profile, 'username' | 'created_at'> | null; error: unknown };

      if (error) {
        console.error('Error loading profile:', error);
        return null;
      }

      if (profile) {
        await ensureDefaultData(supabaseUser.id);
        return {
          id: supabaseUser.id,
          username: profile.username,
          createdAt: new Date(profile.created_at),
        };
      }
      return null;
    } catch (error) {
      console.error('Error loading profile:', error);
      return null;
    }
  }, [ensureDefaultData]);

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Timeout de segurança - 10 segundos máximo
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth timeout')), 10000)
        );
        
        const sessionPromise = supabase.auth.getSession();
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as Awaited<ReturnType<typeof supabase.auth.getSession>>;
        
      if (error) {
        console.error('Session error, clearing auth:', error);
        // Limpar localStorage diretamente para evitar travamento
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
        if (isMounted) setUser(null);
        return;
      }

        if (session?.user && isMounted) {
          const profile = await loadUserProfile(session.user);
          if (isMounted) setUser(profile);
        }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      // Limpar localStorage diretamente (mais seguro que signOut que pode travar)
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      if (isMounted) setUser(null);
    } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    // Set up auth state listener for ONGOING changes
    // IMPORTANT: Callback must be synchronous to avoid Supabase deadlock
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        // Atualização síncrona imediata para logout
        if (!session?.user) {
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        // Defer chamadas ao Supabase com setTimeout para evitar deadlock
        setTimeout(async () => {
          if (!isMounted) return;
          try {
            const profile = await loadUserProfile(session.user);
            if (isMounted) {
              setUser(profile);
              setIsLoading(false);
            }
          } catch (error) {
            console.error('Error loading profile:', error);
            if (isMounted) {
              setUser(null);
              setIsLoading(false);
            }
          }
        }, 0);
      }
    );

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const signUp = useCallback(async (
    username: string, 
    password: string,
    securityQuestion: string,
    securityAnswer: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Validate inputs
    if (!username.trim() || !password) {
      return { success: false, error: 'Usuário e senha são obrigatórios' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Senha deve ter pelo menos 6 caracteres' };
    }
    if (!securityQuestion || !securityAnswer.trim()) {
      return { success: false, error: 'Pergunta e resposta de segurança são obrigatórias' };
    }
    
    try {
      // Check if username exists using RPC (optional - may not exist in external Supabase)
      try {
        const { data: exists, error: checkError } = await supabase
          .rpc('check_username_exists' as never, { p_username: username } as never) as { data: boolean | null; error: unknown };

        if (!checkError && exists) {
          return { success: false, error: 'Este usuário já existe' };
        }
        // If there's an error, we'll let the signUp handle duplicates
        if (checkError) {
          console.warn('check_username_exists RPC not available, skipping check:', checkError);
        }
      } catch (rpcError) {
        console.warn('RPC check skipped:', rpcError);
      }

      // Create user in Supabase Auth
      const email = usernameToEmail(username);
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        // Check for specific errors
        if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
          return { success: false, error: 'Este usuário já existe' };
        }
        if (authError.message?.includes('weak_password') || authError.message?.includes('6 characters')) {
          return { success: false, error: 'Senha deve ter pelo menos 6 caracteres' };
        }
        return { success: false, error: `Erro ao criar conta: ${authError.message}` };
      }

      if (!authData.user) {
        return { success: false, error: 'Erro ao criar conta' };
      }

      // Hash security answer
      const securityAnswerHash = await hashString(securityAnswer.toLowerCase().trim());

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles' as never)
        .insert({
          id: authData.user.id,
          username: username.trim(),
          security_question: securityQuestion,
          security_answer_hash: securityAnswerHash,
        } as never);

      if (profileError) {
        console.error('Profile error:', profileError);
        // Try to clean up the auth user
        await supabase.auth.signOut();
        return { success: false, error: 'Erro ao criar perfil' };
      }

      // Create default data (tags, custom fields, settings)
      await ensureDefaultData(authData.user.id);

      // Set user state
      setUser({
        id: authData.user.id,
        username: username.trim(),
        createdAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      console.error('SignUp error:', error);
      return { success: false, error: 'Erro ao criar conta' };
    }
  }, [ensureDefaultData]);

  const signIn = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const email = usernameToEmail(username);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, error: 'Usuário ou senha incorretos' };
        }
        return { success: false, error: 'Erro ao fazer login' };
      }

      if (!data.user) {
        return { success: false, error: 'Erro ao fazer login' };
      }

      // Profile will be loaded by onAuthStateChange
      return { success: true };
    } catch (error) {
      console.error('SignIn error:', error);
      return { success: false, error: 'Erro ao fazer login' };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const getSecurityQuestion = useCallback(async (username: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .rpc('get_security_question' as never, { p_username: username } as never) as { data: string | null; error: unknown };

      if (error) {
        console.error('Error getting security question:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting security question:', error);
      return null;
    }
  }, []);

  const verifySecurityAnswer = useCallback(async (username: string, answer: string): Promise<boolean> => {
    try {
      const answerHash = await hashString(answer.toLowerCase().trim());
      
      const { data, error } = await supabase
        .rpc('verify_security_answer' as never, { 
          p_username: username, 
          p_answer_hash: answerHash 
        } as never) as { data: boolean | null; error: unknown };

      if (error) {
        console.error('Error verifying security answer:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error verifying security answer:', error);
      return false;
    }
  }, []);

  const resetPassword = useCallback(async (
    username: string,
    securityAnswer: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (newPassword.length < 6) {
      return { success: false, error: 'Senha deve ter pelo menos 6 caracteres' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: {
          username: username.trim(),
          securityAnswer,
          newPassword,
        },
      });

      if (error) {
        console.error('Error resetting password:', error);
        return { success: false, error: 'Erro ao redefinir senha' };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error) {
      console.error('Error resetting password:', error);
      return { success: false, error: 'Erro ao redefinir senha' };
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    getSecurityQuestion,
    verifySecurityAnswer,
    resetPassword,
  };
}
