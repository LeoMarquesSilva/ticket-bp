import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, Eye, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  formatScheduleCaption,
  normalizeSchedule,
  SCHEDULE_DEFAULTS,
  SCHEDULE_DELAY_HOURS_MAX,
} from '../../../supabase/functions/notify-ticket-communications/_shared/rules.mjs';
import {
  TicketCommunicationSettingsService,
  type TicketCommunicationSchedule,
  type TicketCommunicationType,
} from '@/services/ticketCommunicationSettingsService';

const OPTIONS: Array<{
  type: TicketCommunicationType;
  label: string;
  icon: typeof CheckCircle2;
  accent: string;
}> = [
  { type: 'resolved_feedback_invite', label: 'Chamado finalizado', icon: CheckCircle2, accent: '#F69F19' },
  { type: 'awaiting_requester', label: 'Aguardando resposta', icon: Clock3, accent: '#DE5532' },
  { type: 'awaiting_feedback', label: 'Avaliação pendente', icon: Eye, accent: '#BD2D29' },
];

export default function TicketCommunicationScheduleTab() {
  const [schedule, setSchedule] = useState<TicketCommunicationSchedule>(() => normalizeSchedule(SCHEDULE_DEFAULTS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    TicketCommunicationSettingsService.getSchedule()
      .then((value) => { if (alive) setSchedule(value); })
      .catch(() => toast.error('Não foi possível carregar os prazos das mensagens.'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function updateItem(type: TicketCommunicationType, patch: Partial<TicketCommunicationSchedule[TicketCommunicationType]>) {
    setSchedule((current) => normalizeSchedule({
      ...current,
      [type]: { ...current[type], ...patch },
    }));
  }

  function restoreDefaults() {
    setSchedule(normalizeSchedule({}));
    toast.success('Prazos padrão restaurados nesta tela. Clique em salvar para aplicar.');
  }

  async function save() {
    setSaving(true);
    try {
      await TicketCommunicationSettingsService.saveSchedule(schedule);
      setSchedule(await TicketCommunicationSettingsService.getSchedule());
      toast.success('Prazos das mensagens automáticas atualizados.');
    } catch {
      toast.error('Não foi possível salvar os prazos das mensagens.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="h-1 bg-gradient-to-r from-[#F69F19] via-[#DE5532] to-[#BD2D29]" />
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-[#2C2D2F]">
            <span className="rounded-lg bg-[#2C2D2F] p-2 text-white"><CalendarClock className="h-4 w-4" /></span>
            Quando enviar
          </CardTitle>
          <CardDescription>
            Ative ou desative cada aviso e defina depois de quantas horas ele sai. A rotina diária confere os prazos por volta das 9h (Brasília). No chamado finalizado, prazo 0 envia na hora.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {OPTIONS.map((option) => {
            const item = schedule[option.type];
            const Icon = option.icon;
            return (
              <div key={option.type} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 rounded-lg p-2" style={{ backgroundColor: `${option.accent}18`, color: option.accent }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#2C2D2F]">{option.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatScheduleCaption(option.type, item)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <Switch
                      checked={item.enabled}
                      disabled={loading || saving}
                      onCheckedChange={(enabled) => updateItem(option.type, { enabled })}
                    />
                    {item.enabled ? 'Ativa' : 'Desativada'}
                  </label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`schedule-${option.type}-hours`} className="text-xs text-slate-500">Horas</Label>
                    <Input
                      id={`schedule-${option.type}-hours`}
                      type="number"
                      min={0}
                      max={SCHEDULE_DELAY_HOURS_MAX}
                      disabled={loading || saving || !item.enabled}
                      value={item.delayHours}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        if (!Number.isInteger(parsed)) return;
                        updateItem(option.type, {
                          delayHours: Math.min(SCHEDULE_DELAY_HOURS_MAX, Math.max(0, parsed)),
                        });
                      }}
                      className="w-24"
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={() => void save()} disabled={saving || loading}>
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar prazos'}
            </Button>
            <Button type="button" variant="outline" onClick={restoreDefaults} disabled={saving || loading}>
              <RotateCcw className="h-4 w-4" />
              Restaurar padrão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
