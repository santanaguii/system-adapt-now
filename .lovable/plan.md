

# Plano: Correção Definitiva do Loading Infinito

## Diagnóstico Atual

O log mostra:
```
Auth initialization failed: Auth timeout
```

Isso significa que:
1. O timeout de 10s está sendo atingido (a conexão com Supabase está travando)
2. O bloco `catch` é executado
3. MAS a chamada `supabase.auth.signOut()` dentro do `catch` também pode estar travando
4. O `finally` só executa APÓS o `catch` terminar completamente

## Causa Raiz

A sessão corrompida no localStorage está fazendo com que:
- `getSession()` trave indefinidamente → timeout de 10s dispara
- `signOut()` no catch TAMBÉM pode travar tentando comunicar com Supabase
- O `finally` não executa até que `signOut()` termine

## Solução em Duas Partes

### Parte 1: Limpar localStorage ANTES de tentar qualquer operação do Supabase

Se há dados corrompidos, devemos limpá-los **imediatamente** quando detectamos problemas, sem depender do Supabase.

### Parte 2: Adicionar timeout ao signOut também

O `signOut()` não deve travar o sistema.

## Código Proposto

```typescript
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
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (!isMounted) return;
      
      if (session?.user) {
        const profile = await loadUserProfile(session.user);
        if (isMounted) setUser(profile);
      } else {
        setUser(null);
      }
    }
  );

  initializeAuth();

  return () => {
    isMounted = false;
    subscription.unsubscribe();
  };
}, [loadUserProfile]);
```

## Mudança Principal

| Antes | Depois |
|-------|--------|
| `await supabase.auth.signOut()` (pode travar) | Limpeza direta do localStorage com `Object.keys(localStorage).forEach(key => { if (key.startsWith('sb-')) localStorage.removeItem(key); })` |

## Por que isso funciona

1. **Não depende do Supabase**: Ao invés de chamar `signOut()` que pode travar, limpamos diretamente as chaves do Supabase no localStorage
2. **Execução garantida**: `localStorage.removeItem()` é síncrono e nunca trava
3. **Específico**: Só remove chaves que começam com `sb-` (convenção do Supabase)
4. **finally executa**: Como não há mais operações async que podem travar, o `finally` sempre executa

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAuth.ts` | Substituir `signOut()` por limpeza direta do localStorage |

## Ação Imediata para o Usuário

Enquanto isso, você pode resolver agora abrindo o console (F12) e executando:

```javascript
Object.keys(localStorage).forEach(key => { if (key.startsWith('sb-')) localStorage.removeItem(key); });
location.reload();
```

