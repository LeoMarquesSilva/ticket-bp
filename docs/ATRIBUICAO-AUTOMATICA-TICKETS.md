# Sistema de Atribuição Automática de Tickets

## 📋 Resumo da Configuração Atual

### Lógica de Atribuição (Ordem de Prioridade)

Quando um ticket é criado, o sistema segue esta ordem de prioridade para atribuir automaticamente:

#### **Prioridade 1: Atribuição por Subcategoria** ⭐ (Mais Alta)
- Verifica se a subcategoria tem um usuário configurado para atribuição automática
- Exemplo: Se subcategoria "Pedido de urgência" tem `defaultAssignedTo = "João Silva"`, o ticket vai para João Silva

#### **Prioridade 2: Atribuição por Categoria** 
- Se a subcategoria não tem atribuição configurada, verifica se a categoria tem
- Exemplo: Se categoria "Protocolo" tem `defaultAssignedTo = "Maria Santos"`, o ticket vai para Maria Santos

#### **Prioridade 3: Algoritmo Padrão (Próximo Advogado Disponível)** ⚙️
- Se nenhuma atribuição automática estiver configurada, usa o algoritmo padrão
- Busca o próximo advogado (`role = 'lawyer'`) disponível:
  1. **Primeiro**: Tenta encontrar um advogado **online** e **ativo**
     - Ordena por `last_active_at` (mais antigo primeiro - distribuição justa)
  2. **Se não encontrar online**: Tenta encontrar qualquer advogado **ativo**
     - Ordena por `last_active_at` (mais antigo primeiro)

## 🔍 Detalhamento do Algoritmo Padrão

### Função: `UserService.getNextAvailableLawyer()`

```typescript
// 1. Busca advogado ONLINE e ATIVO (prioridade)
SELECT * FROM users
WHERE role = 'lawyer'
  AND is_active = true
  AND is_online = true
ORDER BY last_active_at ASC  -- Mais antigo primeiro (distribuição justa)
LIMIT 1

// 2. Se não encontrar, busca qualquer advogado ATIVO (fallback)
SELECT * FROM users
WHERE role = 'lawyer'
  AND is_active = true
ORDER BY last_active_at ASC  -- Mais antigo primeiro
LIMIT 1
```

### Critérios de Seleção:

1. ✅ **Role**: Apenas usuários com `role = 'lawyer'` (advogados)
2. ✅ **Status Ativo**: Apenas usuários com `is_active = true`
3. ✅ **Online**: Prioriza usuários com `is_online = true`
4. ✅ **Distribuição Justa**: Ordena por `last_active_at` ASC (quem está há mais tempo sem receber ticket)

## 📊 Fluxo Completo de Atribuição

```
Ticket Criado
    │
    ├─> Verifica Categoria/Subcategoria?
    │   │
    │   ├─ SIM → Usa atribuição configurada
    │   │
    │   └─ NÃO → Algoritmo Padrão
    │       │
    │       ├─ Busca Advogado ONLINE + ATIVO
    │       │   │
    │       │   ├─ Encontrou? → Atribui ao advogado
    │       │   │
    │       │   └─ Não encontrou? → Busca qualquer Advogado ATIVO
    │       │       │
    │       │       ├─ Encontrou? → Atribui ao advogado
    │       │       │
    │       │       └─ Não encontrou? → Ticket fica SEM atribuição (status: open)
    │
    └─> Ticket atribuído ou em aberto
```

## 💡 Exemplo Prático

### Cenário 1: Com Atribuição Automática Configurada
```
Categoria: Protocolo
Subcategoria: Pedido de urgência
  └─ defaultAssignedTo: "João Silva"

Ticket Criado:
  - Categoria: protocolo
  - Subcategoria: pedido_urgencia

Resultado:
  ✅ Ticket atribuído automaticamente para: João Silva
  ✅ Status: open (mas já atribuído)
```

### Cenário 2: Sem Atribuição Automática (Algoritmo Padrão)
```
Categoria: Outros
Subcategoria: Outros
  └─ Sem atribuição configurada

Advogados no sistema:
  - Maria (online, ativo, last_active_at: 10:00)
  - João (offline, ativo, last_active_at: 09:00)
  - Pedro (online, ativo, last_active_at: 11:00)

Ticket Criado:
  - Categoria: outros
  - Subcategoria: outros

Resultado:
  ✅ Busca advogado ONLINE → Encontra Maria e Pedro
  ✅ Ordena por last_active_at → Maria (mais antigo)
  ✅ Ticket atribuído automaticamente para: Maria
  ✅ Status: open (mas já atribuído)
```

### Cenário 3: Sem Advogados Disponíveis
```
Nenhum advogado ativo no sistema

Ticket Criado:
  - Categoria: protocolo
  - Subcategoria: pedido_urgencia

Resultado:
  ⚠️ Nenhum advogado encontrado
  ✅ Ticket criado sem atribuição (status: open)
  ✅ Pode ser atribuído manualmente depois
```

## 🎯 Características Importantes

### ✅ O Que Acontece Quando um Ticket é Atribuído:

1. **Campo `assigned_to`**: Preenchido com o ID do usuário
2. **Campo `assigned_to_name`**: Preenchido com o nome do usuário
3. **Campo `assigned_at`**: Preenchido com timestamp atual
4. **Status**: Mantido como `"open"` (não muda para "assigned" automaticamente)

### ⚠️ Importante:

- **Status não muda automaticamente**: O ticket é atribuído, mas o status permanece `"open"` até que o atendente o pegue
- **Apenas advogados**: O algoritmo padrão atribui apenas para usuários com `role = 'lawyer'`
- **Usuários ativos**: Apenas usuários com `is_active = true` são considerados
- **Distribuição justa**: O sistema prioriza quem está há mais tempo sem receber tickets

## 🔧 Como Configurar Atribuição Automática

### Via Interface Admin:

1. Acesse `/categories` como administrador
2. Crie ou edite uma categoria/subcategoria
3. No campo "Atribuição Automática", selecione um usuário da equipe
4. Salve

### Resultado:

- Todos os tickets criados com essa categoria/subcategoria serão automaticamente atribuídos ao usuário escolhido
- A atribuição tem prioridade sobre o algoritmo padrão

## 📝 Código de Referência

### Arquivo: `src/services/ticketService.ts` (createTicket)

```typescript
// Verificar atribuição automática baseada em categoria/subcategoria
let assignedUser: any = null;

try {
  const defaultAssignedUserId = await CategoryService.getDefaultAssignedUser(
    ticketData.category,
    ticketData.subcategory
  );
  
  if (defaultAssignedUserId) {
    // Buscar dados do usuário atribuído
    const { data: userData } = await supabase
      .from(TABLES.USERS)
      .select('id, name, is_active')
      .eq('id', defaultAssignedUserId)
      .eq('is_active', true)
      .single();
    
    if (userData) {
      assignedUser = { id: userData.id, name: userData.name };
    }
  }
} catch (error) {
  console.warn('Erro ao buscar atribuição automática, usando algoritmo padrão:', error);
}

// Se não encontrou atribuição automática, usar algoritmo padrão
if (!assignedUser) {
  const availableLawyer = await UserService.getNextAvailableLawyer();
  if (availableLawyer) {
    assignedUser = availableLawyer;
  }
}

// Atribuir o ticket
if (assignedUser) {
  dbData.assigned_to = assignedUser.id;
  dbData.assigned_to_name = assignedUser.name;
  dbData.assigned_at = new Date().toISOString();
}
```

### Arquivo: `src/services/userService.tsx` (getNextAvailableLawyer)

```typescript
// Primeiro tenta encontrar um advogado online e ativo
const { data, error } = await supabase
  .from(TABLES.USERS)
  .select('*')
  .eq('role', 'lawyer')
  .eq('is_active', true)
  .eq('is_online', true)
  .order('last_active_at', { ascending: true }) // Distribui de forma justa
  .limit(1)
  .single();

if (data) {
  return this.mapFromDatabase(data);
}

// Se não encontrar online, tenta qualquer advogado ativo
const { data: offlineData } = await supabase
  .from(TABLES.USERS)
  .select('*')
  .eq('role', 'lawyer')
  .eq('is_active', true)
  .order('last_active_at', { ascending: true })
  .limit(1)
  .single();

return offlineData ? this.mapFromDatabase(offlineData) : null;
```

## 🎨 Visualização

```
┌─────────────────────────────────────────────┐
│     Sistema de Atribuição Automática        │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
   ┌────▼────┐            ┌─────▼─────┐
   │ Config  │            │  Padrão   │
   │ Categoria│           │ (Advogado)│
   └────┬────┘            └─────┬─────┘
        │                       │
        │    ┌──────────────┐   │
        └───►│  PRIORIDADE  │◄──┘
             │     1        │
             │  2           │
             │  3           │
             └──────┬───────┘
                    │
             ┌──────▼───────┐
             │   Atribuído  │
             └──────────────┘
```
