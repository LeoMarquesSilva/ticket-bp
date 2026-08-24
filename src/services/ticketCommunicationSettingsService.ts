import { normalizeEmailTemplateOverrides } from '../../supabase/functions/notify-ticket-communications/_shared/templates.mjs';
import { IntegrationSettingsService } from './integrationSettingsService';

export const TICKET_COMMUNICATION_EMAIL_TEMPLATES_KEY = 'ticket_communication_email_templates_v1';

export type TicketCommunicationType =
  | 'resolved_feedback_invite'
  | 'awaiting_requester'
  | 'awaiting_feedback';

export type TicketCommunicationTemplate = {
  subject?: string;
  reason?: string;
  action?: string;
};

export type TicketCommunicationTemplateOverrides = Partial<
  Record<TicketCommunicationType, TicketCommunicationTemplate>
>;

export function parseTicketCommunicationSettings(value: string | null): TicketCommunicationTemplateOverrides {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed?.version !== 1) return {};
    return normalizeEmailTemplateOverrides(parsed.templates) as TicketCommunicationTemplateOverrides;
  } catch {
    return {};
  }
}

export class TicketCommunicationSettingsService {
  static async get(): Promise<TicketCommunicationTemplateOverrides> {
    return parseTicketCommunicationSettings(
      await IntegrationSettingsService.getValue(TICKET_COMMUNICATION_EMAIL_TEMPLATES_KEY),
    );
  }

  static async save(value: TicketCommunicationTemplateOverrides): Promise<void> {
    const templates = normalizeEmailTemplateOverrides(value);
    await IntegrationSettingsService.setValue(
      TICKET_COMMUNICATION_EMAIL_TEMPLATES_KEY,
      JSON.stringify({ version: 1, templates }),
    );
  }
}
