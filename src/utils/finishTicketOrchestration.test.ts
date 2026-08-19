import { describe, expect, it } from 'vitest';
import { runFinishTicketOperation } from './finishTicketOrchestration';

describe('runFinishTicketOperation', () => {
  it('executa o caminho de sucesso após finalizar o ticket', async () => {
    const events: string[] = [];

    await runFinishTicketOperation({
      operation: async () => {
        events.push('ticket-finalizado');
        return true;
      },
      onSuccess: () => {
        events.push('fecha-dialogos', 'notifica-finalizacao', 'toast-sucesso');
      },
      onError: () => {
        events.push('toast-erro');
      },
    });

    expect(events).toEqual([
      'ticket-finalizado',
      'fecha-dialogos',
      'notifica-finalizacao',
      'toast-sucesso',
    ]);
  });

  it('não fecha diálogos, notifica finalização ou mostra sucesso quando a finalização falha', async () => {
    const events: string[] = [];
    const failure = new Error('falha ao finalizar');

    await runFinishTicketOperation({
      operation: async () => {
        throw failure;
      },
      onSuccess: () => {
        events.push('fecha-dialogos', 'notifica-finalizacao', 'toast-sucesso');
      },
      onError: (error) => {
        if (error === failure) events.push('toast-erro');
      },
    });

    expect(events).toEqual(['toast-erro']);
  });
});
