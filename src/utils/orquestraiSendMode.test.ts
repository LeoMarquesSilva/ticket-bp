import { describe, expect, it } from 'vitest';
import {
  buildCertificadosTitle,
  certificadosDeadlineIso,
  defaultSendMode,
  includesPpt,
  isoDateFromBr,
  sendModesFor,
} from './orquestraiSendMode';

describe('orquestraiSendMode', () => {
  it('PPT só emite PPT', () => {
    expect(sendModesFor('ppt')).toEqual(['PPT']);
  });

  it('certificados só emite Certificados', () => {
    expect(sendModesFor('certificados')).toEqual(['Certificados']);
  });

  it('misto emite os dois', () => {
    expect(sendModesFor('ppt_e_certificados')).toEqual(['PPT', 'Certificados']);
  });

  it('default é PPT quando precisa ajuste de apresentação', () => {
    expect(defaultSendMode(true)).toBe('ppt');
    expect(defaultSendMode(false)).toBe('certificados');
  });

  it('includesPpt segue o modo', () => {
    expect(includesPpt('ppt')).toBe(true);
    expect(includesPpt('certificados')).toBe(false);
    expect(includesPpt('ppt_e_certificados')).toBe(true);
  });

  it('converte data BR para ISO no mesmo dia', () => {
    expect(isoDateFromBr('26/08/2026')).toBe('2026-08-26');
  });

  it('soma um dia civil para o prazo de certificados', () => {
    expect(certificadosDeadlineIso('26/08/2026')).toBe('2026-08-27');
  });

  it('vira o mês ao somar um dia', () => {
    expect(certificadosDeadlineIso('31/08/2026')).toBe('2026-09-01');
  });

  it('rejeita data inválida', () => {
    expect(certificadosDeadlineIso('32/08/2026')).toBeNull();
    expect(certificadosDeadlineIso('')).toBeNull();
  });

  it('monta título de certificados', () => {
    expect(buildCertificadosTitle('Contratos', 'Workshop')).toBe(
      '[DC] Certificados — Contratos',
    );
  });
});
