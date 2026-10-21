import { describe, expect, it } from 'vitest';
import {
  appendPresencaBlock,
  buildNameDirectory,
  descriptionAlreadyHasPresenca,
  extractTicketIdFromDescription,
  formatPresencaBlock,
  invertLookupMap,
  isPresencaDue,
  isSameTreinamento,
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

  it('troca o bloco de uma consulta anterior em vez de duplicar', () => {
    const base =
      'Lista de presença: https://x\nConsultar após o workshop quem preencheu o registro de presença.';
    expect(
      appendPresencaBlock(`${base}\n\nPresença: não preenchida`, ['Bia', 'Ana']),
    ).toBe(`${base}\n\nPresença:\n- Ana\n- Bia`);
    expect(appendPresencaBlock(`${base}\n\nPresença:\n- Ana`, [])).toBe(
      `${base}\n\nPresença: não preenchida`,
    );
  });

  it('trata itens com mesmo nome e data como o mesmo treinamento', () => {
    const a = { NomedoTreinamento: 'Investigação Patrimonial', Data: '2026-10-15T03:00:00Z' };
    expect(
      isSameTreinamento(a, { Title: 'investigacao  patrimonial', Data: '2026-10-15T03:00:00Z' }),
    ).toBe(true);
    expect(
      isSameTreinamento(a, { NomedoTreinamento: 'Investigação Patrimonial', Data: '2026-10-22T03:00:00Z' }),
    ).toBe(false);
    expect(
      isSameTreinamento(a, { NomedoTreinamento: 'Outro tema', Data: '2026-10-15T03:00:00Z' }),
    ).toBe(false);
    expect(isSameTreinamento({ Title: 'x' }, { Title: 'x' })).toBe(false);
  });

  it('extrai Ticket ID da descrição', () => {
    const id = 'c3b2d3bb-a157-475b-86b3-61da48101cfa';
    expect(extractTicketIdFromDescription(`Ticket ID: ${id}\nTema: x`)).toBe(id);
    expect(extractTicketIdFromDescription('sem id')).toBeNull();
  });

  it('resolve nome a partir do LookupId invertido', () => {
    const directory = {
      siteUsers: {},
      lookupIdToEmail: invertLookupMap({ 'ana@bismarchipires.com.br': '39' }),
      namesByLocalPart: buildNameDirectory([
        { name: 'Ana Silva', email: 'ana@bismarchipires.com.br' },
      ]),
    };
    expect(resolveColaboradorName('39', directory)).toBe('Ana Silva');
    expect(resolveColaboradorName('99', directory)).toBeNull();
  });

  it('usa a lista de usuários do site e o nome completo do cadastro', () => {
    const directory = {
      siteUsers: {
        '29': { name: 'Caroline Simel Abdalla', email: 'carolineabdalla@bpplaw.com.br' },
        '502': { name: 'Catharina Silva', email: 'catharina.silva@bismarchipires.com.br' },
        '700': { name: 'Pessoa Sem Cadastro', email: 'pessoa@bismarchipires.com.br' },
      },
      // O mapa antigo tem nome curto em minúsculas; a lista do site ganha dele.
      lookupIdToEmail: { '29': 'caroline abdalla' },
      namesByLocalPart: buildNameDirectory(
        [
          { name: 'Caroline Simel Abdalla', email: 'carolineabdalla@bismarchipires.com.br' },
          { name: 'Catharina Cardoso da Silva', email: 'catharina.silva@bismarchipires.com.br' },
        ],
        [{ name: 'Catharina S.', email: 'catharina.silva@bpplaw.com.br' }],
      ),
    };
    expect(resolveColaboradorName('29', directory)).toBe('Caroline Simel Abdalla');
    expect(resolveColaboradorName('502', directory)).toBe('Catharina Cardoso da Silva');
    expect(resolveColaboradorName('700', directory)).toBe('Pessoa Sem Cadastro');
  });

  it('sem a lista do site, cai no autor do item, menos a controladoria', () => {
    const directory = {
      siteUsers: {},
      lookupIdToEmail: { '29': 'caroline abdalla' },
      namesByLocalPart: buildNameDirectory([
        { name: 'Lorena Lourenço Miranda', email: 'lorena.miranda@bismarchipires.com.br' },
      ]),
    };
    expect(
      resolveColaboradorName('66', directory, 'Lorena Miranda', 'lorena.miranda@bpplaw.com.br'),
    ).toBe('Lorena Lourenço Miranda');
    expect(
      resolveColaboradorName('29', directory, 'Controladoria', 'controladoria@bpplaw.com.br'),
    ).toBe('caroline abdalla');
    expect(
      resolveColaboradorName('5', directory, 'Controladoria', 'controladoria@bpplaw.com.br'),
    ).toBeNull();
  });
});
