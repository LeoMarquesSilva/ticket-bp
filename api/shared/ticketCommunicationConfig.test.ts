import { describe, expect, it, vi } from 'vitest';
import {
  readTicketCommunicationRuntimeConfig,
} from '../../supabase/functions/notify-ticket-communications/_shared/runtimeConfig.mjs';

const dedicatedEnv = {
  TICKET_COMMUNICATIONS_MICROSOFT_TENANT_ID: 'tenant-id',
  TICKET_COMMUNICATIONS_MICROSOFT_CLIENT_ID: 'client-id',
  TICKET_COMMUNICATIONS_MICROSOFT_CLIENT_SECRET: 'client-secret',
  TICKET_COMMUNICATIONS_MICROSOFT_NOTIFICATION_SENDER: 'notificacoes@bpplaw.com.br',
  TICKET_COMMUNICATIONS_MICROSOFT_REDIRECT_URI: 'https://project.supabase.co/functions/v1/notify-ticket-communications/oauth/callback',
  TICKET_COMMUNICATIONS_MICROSOFT_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  APP_PUBLIC_URL: 'https://responsum.example/helpdesk///',
};

describe('readTicketCommunicationRuntimeConfig', () => {
  it('usa apenas credenciais Microsoft dedicadas e normaliza a base HTTPS', () => {
    const getEnv = vi.fn((name: string) => dedicatedEnv[name as keyof typeof dedicatedEnv]);

    expect(readTicketCommunicationRuntimeConfig(getEnv)).toEqual({
      tenantId: 'tenant-id',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      sender: 'notificacoes@bpplaw.com.br',
      redirectUri: 'https://project.supabase.co/functions/v1/notify-ticket-communications/oauth/callback',
      tokenEncryptionKey: Buffer.alloc(32, 7).toString('base64'),
      appPublicUrl: 'https://responsum.example/helpdesk',
    });
    expect(getEnv).not.toHaveBeenCalledWith('MICROSOFT_TENANT_ID');
    expect(getEnv).not.toHaveBeenCalledWith('MICROSOFT_CLIENT_ID');
    expect(getEnv).not.toHaveBeenCalledWith('MICROSOFT_CLIENT_SECRET');
  });

  it.each([
    'http://responsum.example',
    'https://user:password@responsum.example',
    'https://responsum.example/?tenant=wrong',
    'https://responsum.example/#fragment',
  ])('rejeita APP_PUBLIC_URL insegura ou ambígua: %s', (appPublicUrl) => {
    const env = { ...dedicatedEnv, APP_PUBLIC_URL: appPublicUrl };
    expect(readTicketCommunicationRuntimeConfig((name: string) => env[name as keyof typeof env])).toBeNull();
  });

  it('não aceita silenciosamente as credenciais compartilhadas do SharePoint', () => {
    const legacyOnly = {
      MICROSOFT_TENANT_ID: 'shared-tenant',
      MICROSOFT_CLIENT_ID: 'shared-client',
      MICROSOFT_CLIENT_SECRET: 'shared-secret',
      APP_PUBLIC_URL: 'https://responsum.example',
    };

    expect(readTicketCommunicationRuntimeConfig(
      (name: string) => legacyOnly[name as keyof typeof legacyOnly],
    )).toBeNull();
  });
});
