import { describe, expect, it } from 'vitest';
import { buildOrquestraiPreviewRows } from './orquestraiTreinamentoPreview';
import type { SharepointTreinamentoPayload } from './desenvolvimentoContinuoForm';

const payload: SharepointTreinamentoPayload = {
  tema: 'Contratos',
  facilitador: 'Ana',
  responsavelEmail: 'ana@bismarchipires.com.br',
  responsavelName: 'Ana',
  dataRealizacao: '26/08/2026',
  area: 'Trabalhista',
  subcategory: 'Workshop',
  duracaoMinutos: '45',
  precisaAjustePpt: false,
};

function value(rows: ReturnType<typeof buildOrquestraiPreviewRows>, label: string) {
  return rows.find((row) => row.label === label)?.value;
}

describe('buildOrquestraiPreviewRows', () => {
  it('modo certificados usa tipo oficial e prazo D+1', () => {
    const rows = buildOrquestraiPreviewRows(payload, undefined, 'certificados');
    expect(value(rows, 'Tipo de solicitação')).toBe('Certificados');
    expect(value(rows, 'Prazo')).toBe('Certificados: 2026-08-27');
    expect(value(rows, 'Título no ORQESTRAI')).toContain('[DC] Certificados');
  });

  it('modo PPT não usa Evento', () => {
    const rows = buildOrquestraiPreviewRows(
      { ...payload, precisaAjustePpt: true },
      undefined,
      'ppt',
    );
    expect(value(rows, 'Tipo de solicitação')).toBe('PPT');
    expect(value(rows, 'Prazo')).toBe('PPT: 2026-08-26');
  });

  it('modo misto lista os dois tipos', () => {
    const rows = buildOrquestraiPreviewRows(payload, undefined, 'ppt_e_certificados');
    expect(value(rows, 'Tipo de solicitação')).toBe('PPT + Certificados');
  });
});
