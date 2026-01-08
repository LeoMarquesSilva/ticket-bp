# Controle Inteligente de Som para Notificações

## 📋 Resumo
Implementação de um sistema inteligente que controla quando reproduzir sons de notificação baseado na visibilidade da aba e no estado do chat ativo.

## 🎯 Objetivo
**Problema Original:** Som de notificação tocava sempre, mesmo quando o usuário estava vendo a conversa ativa.

**Solução:** Som só toca quando necessário:
- ✅ Aba oculta/minimizada → **SOM TOCA**
- ✅ Aba visível + chat fechado → **SOM TOCA** 
- ✅ Aba visível + outro chat aberto → **SOM TOCA**
- ❌ Aba visível + chat específico aberto → **SEM SOM**

## 🏗️ Arquitetura da Solução

### 1. Hook `useTabVisibility`
**Arquivo:** `src/hooks/useTabVisibility.ts`

```typescript
// Detecta se a aba do navegador está visível
export const useTabVisibility = () => {
  const [isVisible, setIsVisible] = useState(!document.hidden);
  
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      console.log(visible ? '👁️ Aba ficou visível' : '🙈 Aba ficou oculta');
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  
  return isVisible;
};