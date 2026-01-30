
# Plano: Corrigir Travamento de Login no Ambiente Publicado

## Diagnóstico

O problema é um **deadlock na autenticação** causado por:

1. **Função async no callback do `onAuthStateChange`** - Isso pode travar internamente o Supabase
2. **Chamada ao Supabase dentro do callback** - O `loadUserProfile()` faz query no banco, o que pode causar race conditions
3. **`isLoading` não é definido como `false`** quando ocorre deadlock no listener

O comportamento no preview pode funcionar por timing, mas em produção a latência diferente causa o travamento.

---

## Solução

Seguir a documentação oficial do Supabase:

1. **Remover `async` do callback** - Usar apenas operações síncronas
2. **Usar `setTimeout(0)` para chamadas externas** - Defer qualquer query ao Supabase
3. **Garantir que `isLoading` sempre seja definido** - Adicionar fallback de timeout

---

## Alterações no Código

### Arquivo: `src/hooks/useAuth.ts`

**Antes (problemático):**
```typescript
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
```

**Depois (correto):**
```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    if (!isMounted) return;
    
    // Atualização síncrona imediata
    if (!session?.user) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    
    // Defer chamadas ao Supabase com setTimeout
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
```

---

## Mudanças Completas

| Linha | Alteração |
|-------|-----------|
| 193-204 | Remover `async` do callback e usar `setTimeout(0)` |
| 174-177 | Adicionar `setIsLoading(false)` após carregar perfil inicial |
| Adicionar | Timeout de fallback para garantir que loading termine |

---

## Resultado Esperado

Após a correção:

1. O login não ficará mais travado infinitamente
2. A transição entre estados de autenticação será suave
3. O sistema funcionará igual no preview e no ambiente publicado
4. Qualquer falha de rede resultará em logout limpo em vez de tela travada

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAuth.ts` | Corrigir callback `onAuthStateChange` para evitar deadlock |

---

## Verificação Pós-Implementação

Após aplicar a correção:

1. **Configure as URLs no Supabase** (Authentication > URL Configuration):
   - Site URL: `https://notas-pessoais.lovable.app`
   - Redirect URLs: 
     - `https://notas-pessoais.lovable.app`
     - `https://notas-pessoais.lovable.app/**`
     - `https://id-preview--ead3de47-bf3b-4981-8e72-a3d75555324a.lovable.app`
     - `https://id-preview--ead3de47-bf3b-4981-8e72-a3d75555324a.lovable.app/**`

2. Publique novamente o projeto

3. Teste o login no ambiente publicado
