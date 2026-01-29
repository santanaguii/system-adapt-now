

# Plano: Corrigir Loading Infinito por Sessão Corrompida

## Diagnóstico Confirmado

O sistema funciona em **janela anônima** mas trava no navegador normal. Isso indica:
- **Sessão corrompida** no localStorage
- Dados de autenticação inválidos/expirados salvos
- O Supabase tenta validar uma sessão inválida e o código não trata o erro adequadamente

## Causa Raiz

O código atual em `useAuth.ts` não tem tratamento robusto para:
1. Sessões expiradas ou corrompidas
2. Erros de rede durante validação da sessão
3. Garantia de que `setIsLoading(false)` sempre execute

## Solução em Duas Partes

### Parte 1: Melhorar Robustez do Hook de Autenticação

Modificar `src/hooks/useAuth.ts` para:

1. **Adicionar timeout** para evitar loading infinito
2. **Usar try/catch/finally** garantindo que loading sempre termine
3. **Tratar sessões inválidas** fazendo logout automático
4. **Usar flag isMounted** para evitar updates em componentes desmontados

```typescript
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
        await supabase.auth.signOut();
        if (isMounted) setUser(null);
        return;
      }

      if (session?.user && isMounted) {
        const profile = await loadUserProfile(session.user);
        if (isMounted) setUser(profile);
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      // Em caso de erro, limpar sessão corrompida
      try {
        await supabase.auth.signOut();
      } catch {}
      if (isMounted) setUser(null);
    } finally {
      if (isMounted) setIsLoading(false);
    }
  };

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

### Parte 2: Solução Imediata para o Usuário

O usuário pode resolver agora mesmo limpando o localStorage:

**Opção A - Console do navegador (F12):**
```javascript
localStorage.clear();
location.reload();
```

**Opção B - DevTools:**
1. Abrir DevTools (F12)
2. Aba "Application" (Chrome) ou "Storage" (Firefox)
3. Expandir "Local Storage"
4. Clicar com botão direito → "Clear"
5. Recarregar a página

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAuth.ts` | Reescrever useEffect com timeout, try/catch/finally, e limpeza de sessão corrompida |

## Benefícios da Solução

1. **Timeout de 10s** - Nunca mais loading infinito
2. **Auto-recovery** - Sessões corrompidas são limpas automaticamente
3. **finally block** - Garante que loading sempre termine
4. **Graceful degradation** - Em caso de erro, usuário é redirecionado para login

