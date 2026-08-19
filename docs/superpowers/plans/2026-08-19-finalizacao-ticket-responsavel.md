# Finalização de Ticket com Escolha de Responsável — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que qualquer usuário com permissão de finalizar escolha entre manter o responsável atual ou assumir o ticket antes da resolução, atribuindo automaticamente tickets sem responsável ao finalizador.

**Architecture:** Uma política pura e testável decide a primeira etapa da interface e se a atribuição deve mudar. `FinishTicketButton` usa essa política para orquestrar os diálogos, enquanto `TicketService.finishTicket` grava atribuição e resolução juntas por meio da atualização já existente.

**Tech Stack:** React 19, TypeScript 5.5, Vite 5, Vitest 3, Supabase JS, shadcn/ui.

## Global Constraints

- A regra vale para qualquer usuário com permissão de finalizar tickets, independentemente do cargo.
- Tickets atribuídos ao usuário atual mantêm o fluxo de confirmação existente.
- Tickets atribuídos a outra pessoa oferecem manter o responsável ou transferir para o finalizador.
- Tickets sem responsável são atribuídos automaticamente ao finalizador.
- A decisão de responsável antecede a decisão de evidência em auditorias FATAL.
- Preservar a mensagem automática de NPS e o callback SIOE já existentes.
- Em caso de falha, não executar o callback visual de sucesso nem exibir toast de sucesso.
- Não criar migration, RPC ou nova dependência.
- Preservar alterações não relacionadas já presentes no worktree e stagear somente os arquivos desta funcionalidade.

---

## File Structure

- Create: `src/utils/ticketFinishAssignment.ts` — política pura das etapas e da atribuição.
- Create: `src/utils/ticketFinishAssignment.test.ts` — cobertura unitária das regras de fluxo.
- Create: `src/services/ticketService.finishTicket.test.ts` — cobertura da atualização conjunta no serviço.
- Modify: `src/services/ticketService.ts` — opção de atribuir ao finalizador na mesma resolução.
- Modify: `src/components/FinishTicketButton.tsx` — diálogo de escolha e encadeamento com confirmação/evidência.
- Modify: `src/components/TicketChatPanel.tsx` — fornece o responsável atual ao botão.
- Modify: `src/components/ChatModal.tsx` — fornece o responsável atual ao botão.

### Task 1: Política de decisão do fluxo

**Files:**
- Create: `src/utils/ticketFinishAssignment.test.ts`
- Create: `src/utils/ticketFinishAssignment.ts`

**Interfaces:**
- Consumes: `assignedTo?: string`, `finalizerId?: string`, `isEvidenceAudit: boolean`, `decision?: FinishAssignmentDecision`.
- Produces: `FinishAssignmentDecision`, `FinishTicketStep`, `getInitialFinishTicketStep`, `getFinishStepAfterAssignmentChoice`, `shouldAssignToFinalizer`.

- [ ] **Step 1: Write the failing policy tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  getFinishStepAfterAssignmentChoice,
  getInitialFinishTicketStep,
  shouldAssignToFinalizer,
} from './ticketFinishAssignment';

describe('ticketFinishAssignment', () => {
  it('mantém a confirmação normal quando o ticket pertence ao finalizador', () => {
    expect(getInitialFinishTicketStep({
      assignedTo: 'user-1',
      finalizerId: 'user-1',
      isEvidenceAudit: false,
    })).toBe('confirmation');
  });

  it('pede escolha quando o ticket pertence a outra pessoa', () => {
    expect(getInitialFinishTicketStep({
      assignedTo: 'user-2',
      finalizerId: 'user-1',
      isEvidenceAudit: false,
    })).toBe('assignment-choice');
  });

  it('atribui ticket sem responsável automaticamente ao finalizador', () => {
    expect(shouldAssignToFinalizer(undefined)).toBe(true);
  });

  it('mantém o responsável quando essa opção é escolhida', () => {
    expect(shouldAssignToFinalizer('user-2', 'keep-current')).toBe(false);
  });

  it('atribui ao finalizador quando essa opção é escolhida', () => {
    expect(shouldAssignToFinalizer('user-2', 'assign-to-finalizer')).toBe(true);
  });

  it('leva auditoria FATAL à evidência depois da escolha de responsável', () => {
    expect(getFinishStepAfterAssignmentChoice(true)).toBe('evidence');
  });

  it('leva ticket FATAL sem responsável direto à evidência e exige atribuição', () => {
    expect(getInitialFinishTicketStep({
      assignedTo: undefined,
      finalizerId: 'user-1',
      isEvidenceAudit: true,
    })).toBe('evidence');
    expect(shouldAssignToFinalizer(undefined)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/utils/ticketFinishAssignment.test.ts`

Expected: FAIL because `./ticketFinishAssignment` does not exist.

- [ ] **Step 3: Implement the minimal policy**

```ts
export type FinishAssignmentDecision = 'keep-current' | 'assign-to-finalizer';
export type FinishTicketStep = 'assignment-choice' | 'confirmation' | 'evidence';

interface InitialFinishTicketStepInput {
  assignedTo?: string;
  finalizerId?: string;
  isEvidenceAudit: boolean;
}

export function getFinishStepAfterAssignmentChoice(
  isEvidenceAudit: boolean,
): Exclude<FinishTicketStep, 'assignment-choice'> {
  return isEvidenceAudit ? 'evidence' : 'confirmation';
}

export function getInitialFinishTicketStep({
  assignedTo,
  finalizerId,
  isEvidenceAudit,
}: InitialFinishTicketStepInput): FinishTicketStep {
  if (assignedTo && finalizerId && assignedTo !== finalizerId) {
    return 'assignment-choice';
  }

  return getFinishStepAfterAssignmentChoice(isEvidenceAudit);
}

export function shouldAssignToFinalizer(
  assignedTo?: string,
  decision?: FinishAssignmentDecision,
): boolean {
  return !assignedTo || decision === 'assign-to-finalizer';
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/utils/ticketFinishAssignment.test.ts`

Expected: PASS with 7 tests.

- [ ] **Step 5: Commit the policy**

```powershell
git add -- src/utils/ticketFinishAssignment.ts src/utils/ticketFinishAssignment.test.ts
git commit -m "Adiciona politica de responsavel na finalizacao"
```

### Task 2: Atualização conjunta de responsável e resolução

**Files:**
- Create: `src/services/ticketService.finishTicket.test.ts`
- Modify: `src/services/ticketService.ts:507-563`

**Interfaces:**
- Consumes: `TicketService.finishTicket(ticketId, finalizedBy, options)` com `options.assignToFinalizer?: boolean`.
- Produces: uma única chamada a `updateTicket` com `status: 'resolved'` e, quando solicitado, `assignedTo`, `assignedToName` e `assignedAt`.

- [ ] **Step 1: Write the failing service tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  single: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  TABLES: { TICKETS: 'tickets' },
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: mocks.single })),
      })),
    })),
  },
}));

vi.mock('./evolutionEdgeService', () => ({ notifyTicketWhatsApp: vi.fn() }));

import { TicketService, type Ticket } from './ticketService';

describe('TicketService.finishTicket', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.single.mockResolvedValue({
      data: {
        status: 'in_progress',
        feedback_submitted_at: '2026-08-19T12:00:00.000Z',
        title: 'Ticket',
        category: 'Geral',
        subcategory: 'Geral',
        evidencia_enviada: null,
      },
    });
  });

  it('resolve e atribui ao finalizador na mesma atualização', async () => {
    const update = vi.spyOn(TicketService, 'updateTicket')
      .mockResolvedValue({ id: 'ticket-1' } as Ticket);

    await TicketService.finishTicket(
      'ticket-1',
      { userId: 'user-1', userName: 'Maria' },
      { assignToFinalizer: true },
    );

    expect(update).toHaveBeenCalledWith('ticket-1', {
      status: 'resolved',
      assignedTo: 'user-1',
      assignedToName: 'Maria',
      assignedAt: expect.any(String),
    });
  });

  it('resolve sem alterar a atribuição quando a opção não é usada', async () => {
    const update = vi.spyOn(TicketService, 'updateTicket')
      .mockResolvedValue({ id: 'ticket-1' } as Ticket);

    await TicketService.finishTicket(
      'ticket-1',
      { userId: 'user-1', userName: 'Maria' },
      { assignToFinalizer: false },
    );

    expect(update).toHaveBeenCalledWith('ticket-1', { status: 'resolved' });
  });

  it('recusa atribuição sem os dados do finalizador', async () => {
    const update = vi.spyOn(TicketService, 'updateTicket');

    await expect(TicketService.finishTicket(
      'ticket-1',
      undefined,
      { assignToFinalizer: true },
    )).rejects.toThrow('Usuário finalizador não informado');
    expect(update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/services/ticketService.finishTicket.test.ts`

Expected: FAIL because `assignToFinalizer` is ignored and the update contains only `{ status: 'resolved' }`.

- [ ] **Step 3: Extend the service option and update payload**

Change the signature and insert the guarded assignment immediately after creating `updates`:

```ts
static async finishTicket(
  ticketId: string,
  finalizedBy?: { userId: string; userName: string },
  options?: { evidenciaEnviada?: boolean; assignToFinalizer?: boolean },
): Promise<Ticket> {
```

```ts
const updates: UpdateTicketData = { status: 'resolved' };

if (options?.assignToFinalizer) {
  if (!finalizedBy?.userId || !finalizedBy.userName) {
    throw new Error('Usuário finalizador não informado');
  }

  updates.assignedTo = finalizedBy.userId;
  updates.assignedToName = finalizedBy.userName;
  updates.assignedAt = new Date().toISOString();
}
```

- [ ] **Step 4: Run service and policy tests and verify GREEN**

Run: `npm test -- src/services/ticketService.finishTicket.test.ts src/utils/ticketFinishAssignment.test.ts`

Expected: PASS with 10 tests.

- [ ] **Step 5: Commit the service behavior**

```powershell
git add -- src/services/ticketService.ts src/services/ticketService.finishTicket.test.ts
git commit -m "Finaliza ticket com atribuicao atomica"
```

### Task 3: Integrar a escolha na interface

**Files:**
- Modify: `src/components/FinishTicketButton.tsx:1-278`
- Modify: `src/components/TicketChatPanel.tsx:704-717`
- Modify: `src/components/ChatModal.tsx:669-682`

**Interfaces:**
- Consumes: a política da Task 1 e `TicketService.finishTicket` da Task 2.
- Produces: props `assignedTo?: string` e `assignedToName?: string` em `FinishTicketButtonProps`, além do novo diálogo de escolha.

- [ ] **Step 1: Add failing tests for the assignment dialog copy**

Extend the import with `getFinishAssignmentCopy`, then append to `src/utils/ticketFinishAssignment.test.ts`:

```ts
it('identifica o responsável atual nas opções de finalização', () => {
  expect(getFinishAssignmentCopy('Ana')).toEqual({
    description: 'Este ticket está atribuído a Ana. Escolha como deseja contabilizar a finalização.',
    keepLabel: 'Finalizar com Ana',
    assignLabel: 'Transferir para mim e finalizar',
  });
});

it('usa texto seguro quando o nome do responsável não está disponível', () => {
  expect(getFinishAssignmentCopy(undefined).keepLabel)
    .toBe('Finalizar com o responsável atual');
});
```

- [ ] **Step 2: Run the policy test and verify RED**

Run: `npm test -- src/utils/ticketFinishAssignment.test.ts`

Expected: FAIL because `getFinishAssignmentCopy` is not exported.

- [ ] **Step 3: Implement the dialog copy helper**

Append to `src/utils/ticketFinishAssignment.ts`:

```ts
export function getFinishAssignmentCopy(assignedToName?: string) {
  const currentAssignee = assignedToName?.trim() || 'o responsável atual';
  return {
    description: `Este ticket está atribuído a ${currentAssignee}. Escolha como deseja contabilizar a finalização.`,
    keepLabel: `Finalizar com ${currentAssignee}`,
    assignLabel: 'Transferir para mim e finalizar',
  };
}
```

Run: `npm test -- src/utils/ticketFinishAssignment.test.ts`

Expected: PASS with 9 tests.

- [ ] **Step 4: Add assignment props, state, and dialog routing**

In `FinishTicketButton.tsx`, import the policy and `UserCheck`, add props/state, and route the initial step:

```ts
import { CheckCircle, AlertCircle, FileCheck2, FileX2, UserCheck } from 'lucide-react';
import {
  type FinishAssignmentDecision,
  getFinishAssignmentCopy,
  getFinishStepAfterAssignmentChoice,
  getInitialFinishTicketStep,
  shouldAssignToFinalizer,
} from '@/utils/ticketFinishAssignment';

interface FinishTicketButtonProps {
  ticketId: string;
  ticketTitle: string;
  assignedTo?: string;
  assignedToName?: string;
  ticketDescription?: string;
  category?: string;
  subcategory?: string;
  evidenciaEnviada?: boolean | null;
  isSupport?: boolean;
  onTicketFinished?: () => void;
  className?: string;
}

const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
const [assignToFinalizer, setAssignToFinalizer] = useState(false);
const assignmentCopy = getFinishAssignmentCopy(assignedToName);

const openFinalStep = () => {
  const step = getFinishStepAfterAssignmentChoice(isEvidenciaAudit);
  if (step === 'evidence') setIsEvidenciaDialogOpen(true);
  else setIsConfirmDialogOpen(true);
};

const handleOpen = () => {
  const step = getInitialFinishTicketStep({
    assignedTo,
    finalizerId: user?.id,
    isEvidenceAudit,
  });

  if (step === 'assignment-choice') {
    setIsAssignmentDialogOpen(true);
    return;
  }

  setAssignToFinalizer(shouldAssignToFinalizer(assignedTo));
  if (step === 'evidence') setIsEvidenciaDialogOpen(true);
  else setIsConfirmDialogOpen(true);
};
```

Add a decision handler that passes an explicit override for non-FATAL tickets so it does not depend on asynchronous state propagation:

```ts
const handleAssignmentDecision = (decision: FinishAssignmentDecision) => {
  const shouldAssign = shouldAssignToFinalizer(assignedTo, decision);
  setAssignToFinalizer(shouldAssign);
  setIsAssignmentDialogOpen(false);

  if (isEvidenciaAudit) {
    openFinalStep();
    return;
  }

  void finishTicket(undefined, shouldAssign);
};
```

Change the function signature and both service calls:

```ts
const finishTicket = async (
  evidenciaEnviada?: boolean,
  assignOverride = assignToFinalizer,
) => {
```

```ts
{ evidenciaEnviada: decisao, assignToFinalizer: assignOverride }
```

```ts
{ assignToFinalizer: assignOverride }
```

Close `isAssignmentDialogOpen` after success. In the standard and evidence descriptions, append “Este ticket será atribuído a você antes da finalização.” when `!assignedTo`.

- [ ] **Step 5: Add the assignment-choice dialog**

Place this dialog before the existing standard confirmation:

```tsx
<Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <UserCheck className="h-5 w-5 text-amber-500" />
        Quem deve receber esta finalização?
      </DialogTitle>
      <DialogDescription>
        {assignmentCopy.description}
      </DialogDescription>
    </DialogHeader>
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={isLoading}
        onClick={() => handleAssignmentDecision('keep-current')}
      >
        {assignmentCopy.keepLabel}
      </Button>
      <Button
        type="button"
        disabled={isLoading}
        onClick={() => handleAssignmentDecision('assign-to-finalizer')}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        {assignmentCopy.assignLabel}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={isLoading}
        onClick={() => setIsAssignmentDialogOpen(false)}
      >
        Cancelar
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Step 6: Supply current assignee data at both call sites**

Add to both `FinishTicketButton` instances:

```tsx
assignedTo={selectedTicket.assignedTo}
assignedToName={selectedTicket.assignedToName}
```

Use `ticket.assignedTo` and `ticket.assignedToName` in `ChatModal.tsx`.

- [ ] **Step 7: Run focused tests and compile the integration**

Run: `npm test -- src/utils/ticketFinishAssignment.test.ts src/services/ticketService.finishTicket.test.ts`

Expected: PASS with 12 tests.

Run: `npm run build`

Expected: Vite build completes without TypeScript or bundling errors.

- [ ] **Step 8: Commit the UI integration**

```powershell
git add -- src/components/FinishTicketButton.tsx src/components/TicketChatPanel.tsx src/components/ChatModal.tsx src/utils/ticketFinishAssignment.ts src/utils/ticketFinishAssignment.test.ts
git commit -m "Permite escolher responsavel ao finalizar ticket"
```

### Task 4: Verificação final

**Files:**
- Verify only; modify a feature file only if a command reveals a feature-related defect.

**Interfaces:**
- Consumes: complete feature from Tasks 1–3.
- Produces: evidence that tests, lint, build, scope, and repository state are ready for handoff.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all test files and tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit code 0 and a generated `dist` bundle.

- [ ] **Step 4: Review only the feature diff and commit scope**

Run:

```powershell
git diff HEAD~3 -- src/utils/ticketFinishAssignment.ts src/utils/ticketFinishAssignment.test.ts src/services/ticketService.ts src/services/ticketService.finishTicket.test.ts src/components/FinishTicketButton.tsx src/components/TicketChatPanel.tsx src/components/ChatModal.tsx
git status --short
```

Expected: the diff contains only the approved finalization flow; pre-existing unrelated modifications remain unstaged and untouched.

- [ ] **Step 5: Record any verification-only fix in a scoped commit**

Only when Steps 1–4 required a code correction:

```powershell
git add -- src/utils/ticketFinishAssignment.ts src/utils/ticketFinishAssignment.test.ts src/services/ticketService.ts src/services/ticketService.finishTicket.test.ts src/components/FinishTicketButton.tsx src/components/TicketChatPanel.tsx src/components/ChatModal.tsx
git commit -m "Corrige verificacao da finalizacao de tickets"
```

If no correction was needed, do not create an empty commit.
