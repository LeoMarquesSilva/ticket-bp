import { describe, expect, it } from 'vitest';
import {
  appendPresencaBlock,
  descriptionAlreadyHasPresenca,
  extractTicketIdFromDescription,
  formatPresencaBlock,
  invertLookupMap,
  isPresencaDue,
  resolveColaboradorName,
} from './orquestraiPresenca';

describe('orquestraiPresenca', () => {
  it('vazio vira não preenchida', () => {
    expect(formatPresencaBlock([])).toBe('Presença: não preenchida');
    expect(formatPresencaBlock(['  '])).toBe('Presença: não preenchida');
  });

  it('lista nomes ordenados e únicos', () => {
    expect(formatPresencaBlock(['Bia', 'Ana', 'Ana'])).toBe(
      'Presença:\n- Ana\n- Bia',
    );
  });

  it('detecta marcador em qualquer linha', () => {
    expect(descriptionAlreadyHasPresenca('x\nPresença: não preenchida')).toBe(true);
    expect(descriptionAlreadyHasPresenca('Presença:\n- Ana')).toBe(true);
    expect(descriptionAlreadyHasPresenca('sem marcador')).toBe(false);
  });

  it('só processa depois que o D+1 passou', () => {
    expect(isPresencaDue('2026-08-27', '2026-08-27')).toBe(false);
    expect(isPresencaDue('2026-08-27', '2026-08-26')).toBe(false);
    expect(isPresencaDue('2026-08-27', '2026-08-28')).toBe(true);
  });

  it('anexa o bloco ao final da descrição', () => {
    expect(appendPresencaBlock('Origem: Responsum', [])).toBe(
      'Origem: Responsum\n\nPresença: não preenchida',
    );
  });

  it('extrai Ticket ID da descrição', () => {
    const id = 'c3b2d3bb-a157-475b-86b3-61da48101cfa';
    expect(extractTicketIdFromDescription(`Ticket ID: ${id}\nTema: x`)).toBe(id);
    expect(extractTicketIdFromDescription('sem id')).toBeNull();
  });

  it('resolve nome a partir do LookupId invertido', () => {
    const inverted = invertLookupMap({
      'ana@bismarchipires.com.br': '39',
    });
    expect(
      resolveColaboradorName('39', inverted, {
        'ana@bismarchipires.com.br': 'Ana Silva',
      }),
    ).toBe('Ana Silva');
    expect(resolveColaboradorName('99', inverted, {})).toBeNull();
  });
});
