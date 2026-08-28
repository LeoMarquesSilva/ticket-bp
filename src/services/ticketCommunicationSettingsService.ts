import { normalizeSchedule } from '../../supabase/functions/notify-ticket-communications/_shared/rules.mjs';
import {
  normalizeEmailTemplateOverrides,
  normalizeTeamsTemplateOverrides,
} from '../../supabase/functions/notify-ticket-communications/_shared/templates.mjs';
import { IntegrationSettingsService } from './integrationSettingsService';

export const TICKET_COMMUNICATION_EMAIL_TEMPLATES_KEY = 'ticket_communication_email_templates_v1';
export const TICKET_COMMUNICATION_TEAMS_TEMPLATES_KEY = 'ticket_communication_teams_templates_v1';
export const TICKET_COMMUNICATION_SCHEDULE_KEY = 'ticket_communication_schedule_v1';

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

export type TicketCommunicationScheduleItem = {
  enabled: boolean;
  delayHours: number;
};

export type TicketCommunicationSchedule = Record<TicketCommunicationType, TicketCommunicationScheduleItem>;

function parseVersionedTemplates(
  value: string | null,
  normalize: (templates: unknown) => TicketCommunicationTemplateOverrides,
): TicketCommunicationTemplateOverrides {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed?.version !== 1) return {};
    return normalize(parsed.templates);
  } catch {
    return {};
  }
}

export function parseTicketCommunicationSettings(value: string | null): TicketCommunicationTemplateOverrides {
  return parseVersionedTemplates(value, normalizeEmailTemplateOverrides);
}

export function parseTicketCommunicationTeamsSettings(value: string | null): TicketCommunicationTemplateOverrides {
  return parseVersionedTemplates(value, normalizeTeamsTemplateOverrides);
}

export function parseTicketCommunicationSchedule(value: string | null): TicketCommunicationSchedule {
  if (!value) return normalizeSchedule({});
  try {
    const parsed = JSON.parse(value);
    if (parsed?.version !== 1) return normalizeSchedule({});
    return normalizeSchedule(parsed.schedule);
  } catch {
    return normalizeSchedule({});
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

  static async getTeams(): Promise<TicketCommunicationTemplateOverrides> {
    return parseTicketCommunicationTeamsSettings(
      await IntegrationSettingsService.getValue(TICKET_COMMUNICATION_TEAMS_TEMPLATES_KEY),
    );
  }

  static async saveTeams(value: TicketCommunicationTemplateOverrides): Promise<void> {
    const templates = normalizeTeamsTemplateOverrides(value);
    await IntegrationSettingsService.setValue(
      TICKET_COMMUNICATION_TEAMS_TEMPLATES_KEY,
      JSON.stringify({ version: 1, templates }),
    );
  }

  static async getSchedule(): Promise<TicketCommunicationSchedule> {
    return parseTicketCommunicationSchedule(
      await IntegrationSettingsService.getValue(TICKET_COMMUNICATION_SCHEDULE_KEY),
    );
  }

  static async saveSchedule(value: Partial<TicketCommunicationSchedule> & Record<string, unknown>): Promise<void> {
    const schedule = normalizeSchedule(value);
    await IntegrationSettingsService.setValue(
      TICKET_COMMUNICATION_SCHEDULE_KEY,
      JSON.stringify({ version: 1, schedule }),
    );
  }
}
