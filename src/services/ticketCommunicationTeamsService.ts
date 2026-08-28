import { supabase } from '@/lib/supabase';

export type TicketCommunicationTeamsStatus = {
  connected: boolean;
  accountEmail: string | null;
  accountDisplayName: string | null;
  connectedAt: string | null;
};

async function invoke(action: string, failureMessage: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('notify-ticket-communications', {
    body: { action },
  });
  const body = data as Record<string, unknown> | null;
  if (error || !body || body.error) throw new Error(failureMessage);
  return body;
}

export class TicketCommunicationTeamsService {
  static async getStatus(): Promise<TicketCommunicationTeamsStatus> {
    const body = await invoke(
      'teams_oauth_status',
      'Não foi possível consultar a conexão do Teams.',
    );
    const teams = body.teams as TicketCommunicationTeamsStatus | undefined;
    if (!teams || typeof teams.connected !== 'boolean') {
      throw new Error('Não foi possível consultar a conexão do Teams.');
    }
    return teams;
  }

  static async startConnection(): Promise<string> {
    const body = await invoke(
      'teams_oauth_start',
      'Não foi possível iniciar a conexão do Teams.',
    );
    if (typeof body.authorizationUrl !== 'string' || !body.authorizationUrl) {
      throw new Error('Não foi possível iniciar a conexão do Teams.');
    }
    return body.authorizationUrl;
  }

  static async disconnect(): Promise<void> {
    await invoke(
      'teams_oauth_disconnect',
      'Não foi possível desconectar a conta do Teams.',
    );
  }
}
