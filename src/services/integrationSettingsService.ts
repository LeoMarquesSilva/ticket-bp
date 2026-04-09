import { supabase, TABLES } from '@/lib/supabase';

const EVOLUTION_INSTANCE_KEY = 'evolution_instance_name';

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
}
