import { supabase, TABLES } from '@/lib/supabase';

const EVOLUTION_INSTANCE_KEY = 'evolution_instance_name';
const STALE_TICKET_RECIPIENT_KEY = 'stale_ticket_whatsapp_recipient';
const STALE_TICKET_DAYS_KEY = 'stale_ticket_whatsapp_days';
const STALE_TICKET_TEMPLATE_KEY = 'stale_ticket_whatsapp_template';

export class IntegrationSettingsService {
  static async getValue(key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from(TABLES.INTEGRATION_SETTINGS)
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) {
      console.error('IntegrationSettingsService.getValue:', error);
      throw error;
    }
    return data?.value?.trim() || null;
  }

  static async setValue(key: string, value: string): Promise<void> {
    const { error } = await supabase
      .from(TABLES.INTEGRATION_SETTINGS)
      .upsert(
        {
          key,
          value: value.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' },
      );
    if (error) {
      console.error('IntegrationSettingsService.setValue:', error);
      throw error;
    }
  }

  static async getEvolutionInstanceName(): Promise<string | null> {
    return this.getValue(EVOLUTION_INSTANCE_KEY);
  }

  static async setEvolutionInstanceName(name: string): Promise<void> {
    await this.setValue(EVOLUTION_INSTANCE_KEY, name);
  }

  static async getStaleTicketRecipient(): Promise<string | null> {
    return this.getValue(STALE_TICKET_RECIPIENT_KEY);
  }

  static async setStaleTicketRecipient(value: string): Promise<void> {
    await this.setValue(STALE_TICKET_RECIPIENT_KEY, value);
  }

  static async getStaleTicketDays(): Promise<string | null> {
    return this.getValue(STALE_TICKET_DAYS_KEY);
  }

  static async setStaleTicketDays(value: string): Promise<void> {
    await this.setValue(STALE_TICKET_DAYS_KEY, value);
  }

  static async getStaleTicketTemplate(): Promise<string | null> {
    return this.getValue(STALE_TICKET_TEMPLATE_KEY);
  }

  static async setStaleTicketTemplate(value: string): Promise<void> {
    await this.setValue(STALE_TICKET_TEMPLATE_KEY, value);
  }
}
