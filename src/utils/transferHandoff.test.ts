import { describe, expect, it } from 'vitest';
import {
  buildTransferHandoffMessage,
  findLatestTransferHandoff,
  parseTransferHandoffMessage,
} from './transferHandoff';

describe('transferHandoff', () => {
  it('preserva a orientação e os nomes na ida e na volta', () => {
    const message = buildTransferHandoffMessage({
      fromName: '  João  ',
      toName: ' Maria ',
      note: '  Conferir o contrato\nanexo até sexta.  ',
    });

    expect(parseTransferHandoffMessage(message)).toEqual({
      fromName: 'João',
      toName: 'Maria',
      note: 'Conferir o contrato\nanexo até sexta.',
    });
  });

  it('ignora mensagens comuns do chat', () => {
    expect(parseTransferHandoffMessage('Categoria alterada')).toBeNull();
    expect(parseTransferHandoffMessage('[[transfer-handoff]]\n{')).toBeNull();
  });

  it('encontra a orientação mais recente', () => {
    const latest = findLatestTransferHandoff([
      { message: 'olá' },
      {
        message: buildTransferHandoffMessage({
          fromName: 'Ana',
          toName: 'Bruno',
          note: 'Primeira',
        }),
      },
      {
        message: buildTransferHandoffMessage({
          fromName: 'Bruno',
          toName: 'Carla',
          note: 'Segunda',
        }),
      },
    ]);

    expect(latest?.note).toBe('Segunda');
    expect(latest?.toName).toBe('Carla');
  });
});
