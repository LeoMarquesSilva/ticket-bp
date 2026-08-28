import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, Eye, Link2, Loader2, Mail, MessageSquare, MessageSquareText, Monitor, RotateCcw, Save, Smartphone, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  formatScheduleCaption,
  normalizeSchedule,
  SCHEDULE_DEFAULTS,
  SCHEDULE_DELAY_HOURS_MAX,
} from '../../../supabase/functions/notify-ticket-communications/_shared/rules.mjs';
import {
  EMAIL_TEMPLATE_DEFAULTS,
  TEAMS_TEMPLATE_DEFAULTS,
  buildNotificationContent,
} from '../../../supabase/functions/notify-ticket-communications/_shared/templates.mjs';
import {
  TicketCommunicationSettingsService,
  type TicketCommunicationSchedule,
  type TicketCommunicationTemplateOverrides,
  type TicketCommunicationType,
} from '@/services/ticketCommunicationSettingsService';
import {
  TicketCommunicationTeamsService,
  type TicketCommunicationTeamsStatus,
} from '@/services/ticketCommunicationTeamsService';
import { TeamsAdaptiveCardPreview } from './TeamsAdaptiveCardPreview';
import UserAssigneePicker from '@/components/UserAssigneePicker';
import { UserService } from '@/services/userService';
import type { User } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  lawyer: 'Advogado',
  support: 'Suporte',
  user: 'Usuário',
};

const OPTIONS: Array<{
  type: TicketCommunicationType;
  label: string;
  icon: typeof Mail;
  accent: string;
}> = [
  { type: 'resolved_feedback_invite', label: 'Chamado finalizado', icon: CheckCircle2, accent: '#F69F19' },
  { type: 'awaiting_requester', label: 'Aguardando resposta', icon: Clock3, accent: '#DE5532' },
  { type: 'awaiting_feedback', label: 'Avaliação pendente', icon: Eye, accent: '#BD2D29' },
];

const SAMPLE_TICKET = {
  id: 'exemplo-1234',
  title: 'Acesso ao sistema de indicadores',
};

type TeamsConnectionCardProps = {
  loading: boolean;
  busy: boolean;
  status: TicketCommunicationTeamsStatus | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onSendTest?: () => void;
  canSendTest?: boolean;
};

function connectedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

export function TeamsConnectionCard({
  loading,
  busy,
  status,
  onConnect,
  onDisconnect,
  onSendTest,
  canSendTest = true,
}: TeamsConnectionCardProps) {
  const connected = status?.connected === true;
  const connectedAt = connectedDate(status?.connectedAt);

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="h-1 bg-[#5B5FC7]" />
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-xl bg-[#5B5FC7]/10 p-2.5 text-[#5B5FC7]">
            <MessageSquareText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-[#2C2D2F]">Microsoft Teams</h2>
              {loading ? (
                <Badge variant="secondary">Verificando conexão</Badge>
              ) : connected ? (
                <Badge variant="success">Conectado</Badge>
              ) : (
                <Badge variant="warning">Não conectado</Badge>
              )}
            </div>
            {connected ? (
              <div className="mt-1 text-sm text-slate-600">
                <p className="truncate font-medium text-slate-800">{status?.accountDisplayName || 'Conta Microsoft'}</p>
                <p className="truncate">{status?.accountEmail}</p>
                {connectedAt && <p className="mt-1 text-xs text-slate-400">Conectada em {connectedAt}</p>}
              </div>
            ) : (
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Conecte uma conta corporativa para enviar avisos em chats individuais. Os colaboradores não precisam instalar aplicativo.
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" onClick={onConnect} disabled={loading || busy} className="bg-[#5B5FC7] text-white hover:bg-[#4b4fa8]">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {connected ? 'Conectar novamente' : 'Conectar conta do Teams'}
          </Button>
          {connected && onSendTest && (
            <Button type="button" variant="outline" onClick={onSendTest} disabled={busy || !canSendTest}>
              <MessageSquare className="h-4 w-4" />
              Enviar teste
            </Button>
          )}
          {connected && (
            <Button type="button" variant="outline" onClick={onDisconnect} disabled={busy}>
              <Unplug className="h-4 w-4" />
              Desconectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TicketCommunicationsTab() {
  const [activeType, setActiveType] = useState<TicketCommunicationType>('resolved_feedback_invite');
  const [teamsType, setTeamsType] = useState<TicketCommunicationType>('resolved_feedback_invite');
  const [settings, setSettings] = useState<TicketCommunicationTemplateOverrides>({});
  const [teamsSettings, setTeamsSettings] = useState<TicketCommunicationTemplateOverrides>({});
  const [schedule, setSchedule] = useState<TicketCommunicationSchedule>(() => normalizeSchedule(SCHEDULE_DEFAULTS));
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [teamsDevice, setTeamsDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTeams, setSavingTeams] = useState(false);
  const [teamsStatus, setTeamsStatus] = useState<TicketCommunicationTeamsStatus | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsBusy, setTeamsBusy] = useState(false);
  const [testUsers, setTestUsers] = useState<User[]>([]);
  const [testUserId, setTestUserId] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      TicketCommunicationSettingsService.get(),
      TicketCommunicationSettingsService.getTeams(),
      TicketCommunicationSettingsService.getSchedule(),
    ])
      .then(([emailValue, teamsValue, scheduleValue]) => {
        if (!alive) return;
        setSettings(emailValue);
        setTeamsSettings(teamsValue);
        setSchedule(scheduleValue);
      })
      .catch(() => toast.error('Não foi possível carregar os textos das comunicações.'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    UserService.getAllUsers(false)
      .then((users) => {
        if (alive) setTestUsers(users.filter((user) => UserService.isSelectableUser(user) && user.email));
      })
      .catch(() => {
        if (alive) toast.error('Não foi possível carregar os usuários para o teste.');
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setTeamsLoading(true);
    TicketCommunicationTeamsService.getStatus()
      .then((value) => { if (alive) setTeamsStatus(value); })
      .catch(() => toast.error('Não foi possível consultar a conexão do Teams.'))
      .finally(() => { if (alive) setTeamsLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const result = url.searchParams.get('teams');
    if (result === 'connected') toast.success('Conta do Microsoft Teams conectada.');
    if (result === 'error') toast.error('Não foi possível concluir a conexão do Teams.');
    if (result) {
      url.searchParams.delete('teams');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  const defaults = EMAIL_TEMPLATE_DEFAULTS[activeType];
  const draft = { ...defaults, ...(settings[activeType] ?? {}) };
  const teamsDefaults = TEAMS_TEMPLATE_DEFAULTS[teamsType];
  const teamsDraft = { ...teamsDefaults, ...(teamsSettings[teamsType] ?? {}) };
  const activeOption = OPTIONS.find((option) => option.type === activeType)!;
  const teamsOption = OPTIONS.find((option) => option.type === teamsType)!;
  const preview = useMemo(() => buildNotificationContent({
    type: activeType,
    ticket: SAMPLE_TICKET,
    requester: { name: 'Leonardo' },
    appBaseUrl: 'https://responsum.example',
    emailTemplateOverrides: settings,
  }), [activeType, settings]);
  const teamsPreview = useMemo(() => buildNotificationContent({
    type: teamsType,
    ticket: SAMPLE_TICKET,
    requester: { name: 'Leonardo' },
    appBaseUrl: 'https://responsum.example',
    teamsTemplateOverrides: teamsSettings,
  }), [teamsType, teamsSettings]);

  function updateField(field: 'subject' | 'reason' | 'action', value: string) {
    setSettings((current) => ({
      ...current,
      [activeType]: { ...(current[activeType] ?? {}), [field]: value },
    }));
  }

  function updateTeamsField(field: 'subject' | 'reason' | 'action', value: string) {
    setTeamsSettings((current) => ({
      ...current,
      [teamsType]: { ...(current[teamsType] ?? {}), [field]: value },
    }));
  }

  function restoreDefaults() {
    setSettings((current) => {
      const next = { ...current };
      delete next[activeType];
      return next;
    });
    toast.success('Textos padrão restaurados nesta prévia. Clique em salvar para aplicar.');
  }

  function restoreTeamsDefaults() {
    setTeamsSettings((current) => {
      const next = { ...current };
      delete next[teamsType];
      return next;
    });
    toast.success('Textos padrão do Teams restaurados nesta prévia. Clique em salvar para aplicar.');
  }

  async function save() {
    setSaving(true);
    try {
      await TicketCommunicationSettingsService.save(settings);
      setSettings(await TicketCommunicationSettingsService.get());
      toast.success('Comunicações atualizadas com sucesso.');
    } catch {
      toast.error('Não foi possível salvar as comunicações.');
    } finally {
      setSaving(false);
    }
  }

  function updateScheduleItem(type: TicketCommunicationType, patch: Partial<TicketCommunicationSchedule[TicketCommunicationType]>) {
    setSchedule((current) => normalizeSchedule({
      ...current,
      [type]: { ...current[type], ...patch },
    }));
  }

  function restoreScheduleDefaults() {
    setSchedule(normalizeSchedule({}));
    toast.success('Prazos padrão restaurados nesta tela. Clique em salvar para aplicar.');
  }

  async function saveSchedule() {
    setSavingSchedule(true);
    try {
      await TicketCommunicationSettingsService.saveSchedule(schedule);
      setSchedule(await TicketCommunicationSettingsService.getSchedule());
      toast.success('Prazos das mensagens automáticas atualizados.');
    } catch {
      toast.error('Não foi possível salvar os prazos das mensagens.');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function saveTeams() {
    setSavingTeams(true);
    try {
      await TicketCommunicationSettingsService.saveTeams(teamsSettings);
      setTeamsSettings(await TicketCommunicationSettingsService.getTeams());
      toast.success('Mensagens do Teams atualizadas com sucesso.');
    } catch {
      toast.error('Não foi possível salvar as mensagens do Teams.');
    } finally {
      setSavingTeams(false);
    }
  }

  async function connectTeams() {
    setTeamsBusy(true);
    try {
      const authorizationUrl = await TicketCommunicationTeamsService.startConnection();
      window.location.assign(authorizationUrl);
    } catch {
      toast.error('Não foi possível iniciar a conexão do Teams.');
      setTeamsBusy(false);
    }
  }

  async function disconnectTeams() {
    setTeamsBusy(true);
    try {
      await TicketCommunicationTeamsService.disconnect();
      setTeamsStatus({ connected: false, accountEmail: null, accountDisplayName: null, connectedAt: null });
      toast.success('Conta do Teams desconectada.');
    } catch {
      toast.error('Não foi possível desconectar a conta do Teams.');
    } finally {
      setTeamsBusy(false);
    }
  }

  const testUser = testUsers.find((user) => user.id === testUserId);
  const canSendTest = Boolean(testUser?.email);

  async function sendTeamsTest(type?: TicketCommunicationType) {
    if (!testUser?.email) {
      toast.error('Escolha um usuário para enviar o teste.');
      return;
    }
    setTeamsBusy(true);
    try {
      await TicketCommunicationTeamsService.sendTestMessage(testUser.email, type, testUser.name);
      toast.success(`Mensagem de teste enviada para ${testUser.name}.`);
    } catch {
      toast.error('Não foi possível enviar a mensagem de teste do Teams.');
    } finally {
      setTeamsBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <TeamsConnectionCard
        loading={teamsLoading}
        busy={teamsBusy}
        status={teamsStatus}
        onConnect={() => void connectTeams()}
        onDisconnect={() => void disconnectTeams()}
        onSendTest={() => void sendTeamsTest()}
        canSendTest={canSendTest}
      />
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label>Destinatário do teste</Label>
            <UserAssigneePicker
              users={testUsers}
              value={testUserId}
              onChange={setTestUserId}
              getRoleLabel={(role) => ROLE_LABELS[role] ?? role}
              noneLabel="Escolher usuário"
              allowNone
            />
            <p className="text-xs text-slate-500">O teste vai para o Teams deste usuário, com a conta remetente conectada.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void sendTeamsTest()}
            disabled={teamsBusy || teamsStatus?.connected !== true || !canSendTest}
          >
            {teamsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            Enviar teste
          </Button>
        </CardContent>
      </Card>
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
            return (
              <div key={option.type} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#2C2D2F]">{option.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{formatScheduleCaption(option.type, item)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <Switch
                      checked={item.enabled}
                      disabled={loading || savingSchedule}
                      onCheckedChange={(enabled) => updateScheduleItem(option.type, { enabled })}
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
                      disabled={loading || savingSchedule || !item.enabled}
                      value={item.delayHours}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        if (!Number.isInteger(parsed)) return;
                        updateScheduleItem(option.type, {
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
            <Button type="button" onClick={() => void saveSchedule()} disabled={savingSchedule || loading}>
              <Save className="h-4 w-4" />
              {savingSchedule ? 'Salvando...' : 'Salvar prazos'}
            </Button>
            <Button type="button" variant="outline" onClick={restoreScheduleDefaults} disabled={savingSchedule || loading}>
              <RotateCcw className="h-4 w-4" />
              Restaurar padrão
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="h-1 bg-gradient-to-r from-[#F69F19] via-[#DE5532] to-[#BD2D29]" />
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-[#2C2D2F]">
              <span className="rounded-lg bg-[#2C2D2F] p-2 text-white"><Mail className="h-4 w-4" /></span>
              E-mails de chamados
            </CardTitle>
            <CardDescription>Selecione uma comunicação e ajuste somente os textos seguros.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = option.type === activeType;
              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setActiveType(option.type)}
                  className={cn(
                    'w-full rounded-xl border p-3 text-left transition-all',
                    active ? 'border-[#F69F19]/50 bg-[#F69F19]/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-lg p-2" style={{ backgroundColor: `${option.accent}18`, color: option.accent }}><Icon className="h-4 w-4" /></span>
                    <span><span className="block text-sm font-semibold text-[#2C2D2F]">{option.label}</span><span className="mt-0.5 block text-xs text-slate-500">{formatScheduleCaption(option.type, schedule[option.type])}</span></span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Conteúdo</CardTitle>
            <CardDescription>Variável disponível no assunto: <code className="rounded bg-slate-100 px-1 py-0.5">{'{title}'}</code></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="email-subject">Assunto do e-mail</Label><Input id="email-subject" maxLength={140} disabled={loading} value={draft.subject} onChange={(event) => updateField('subject', event.target.value)} /><p className="text-right text-[11px] text-slate-400">{draft.subject.length}/140</p></div>
            <div className="space-y-1.5"><Label htmlFor="email-reason">Texto principal</Label><Textarea id="email-reason" rows={4} maxLength={320} disabled={loading} value={draft.reason} onChange={(event) => updateField('reason', event.target.value)} /><p className="text-right text-[11px] text-slate-400">{draft.reason.length}/320</p></div>
            <div className="space-y-1.5"><Label htmlFor="email-action">Texto do botão</Label><Input id="email-action" maxLength={48} disabled={loading} value={draft.action} onChange={(event) => updateField('action', event.target.value)} /><p className="text-right text-[11px] text-slate-400">{draft.action.length}/48</p></div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" onClick={() => void save()} disabled={saving || loading} className="bg-[#2C2D2F] text-white hover:bg-black"><Save className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar alterações'}</Button>
              <Button type="button" variant="outline" onClick={restoreDefaults} disabled={saving || loading}><RotateCcw className="h-4 w-4" />Restaurar padrão</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden border-slate-200 bg-[#E9ECEF] shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-white py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle className="text-base">Prévia do destinatário</CardTitle><CardDescription className="mt-1">{activeOption.label} · {preview.email.subject}</CardDescription></div>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button type="button" aria-label="Prévia desktop" onClick={() => setDevice('desktop')} className={cn('rounded-md p-2', device === 'desktop' ? 'bg-white text-[#DE5532] shadow-sm' : 'text-slate-400')}><Monitor className="h-4 w-4" /></button>
              <button type="button" aria-label="Prévia mobile" onClick={() => setDevice('mobile')} className={cn('rounded-md p-2', device === 'mobile' ? 'bg-white text-[#DE5532] shadow-sm' : 'text-slate-400')}><Smartphone className="h-4 w-4" /></button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-[760px] justify-center p-4 md:p-6">
          <div className={cn('overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xl transition-all duration-300', device === 'mobile' ? 'w-[390px]' : 'w-full max-w-[760px]')}>
            <iframe title="Prévia do e-mail" sandbox="" srcDoc={preview.email.html} className="h-[720px] w-full border-0 bg-white" />
          </div>
        </CardContent>
      </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="h-1 bg-[#5B5FC7]" />
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-[#2C2D2F]">
              <span className="rounded-lg bg-[#5B5FC7] p-2 text-white"><MessageSquareText className="h-4 w-4" /></span>
              Mensagens do Teams
            </CardTitle>
            <CardDescription>Os mesmos avisos do e-mail, com layout de cartão no chat 1:1.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = option.type === teamsType;
              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setTeamsType(option.type)}
                  className={cn(
                    'w-full rounded-xl border p-3 text-left transition-all',
                    active ? 'border-[#5B5FC7]/50 bg-[#5B5FC7]/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-lg p-2" style={{ backgroundColor: `${option.accent}18`, color: option.accent }}><Icon className="h-4 w-4" /></span>
                    <span><span className="block text-sm font-semibold text-[#2C2D2F]">{option.label}</span><span className="mt-0.5 block text-xs text-slate-500">{formatScheduleCaption(option.type, schedule[option.type])}</span></span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Conteúdo</CardTitle>
            <CardDescription>Variável disponível no título: <code className="rounded bg-slate-100 px-1 py-0.5">{'{title}'}</code></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="teams-subject">Título da mensagem</Label><Input id="teams-subject" maxLength={140} disabled={loading} value={teamsDraft.subject} onChange={(event) => updateTeamsField('subject', event.target.value)} /><p className="text-right text-[11px] text-slate-400">{teamsDraft.subject.length}/140</p></div>
            <div className="space-y-1.5"><Label htmlFor="teams-reason">Texto principal</Label><Textarea id="teams-reason" rows={4} maxLength={320} disabled={loading} value={teamsDraft.reason} onChange={(event) => updateTeamsField('reason', event.target.value)} /><p className="text-right text-[11px] text-slate-400">{teamsDraft.reason.length}/320</p></div>
            <div className="space-y-1.5"><Label htmlFor="teams-action">Texto do botão</Label><Input id="teams-action" maxLength={48} disabled={loading} value={teamsDraft.action} onChange={(event) => updateTeamsField('action', event.target.value)} /><p className="text-right text-[11px] text-slate-400">{teamsDraft.action.length}/48</p></div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" onClick={() => void saveTeams()} disabled={savingTeams || loading} className="bg-[#5B5FC7] text-white hover:bg-[#4b4fa8]"><Save className="h-4 w-4" />{savingTeams ? 'Salvando...' : 'Salvar alterações'}</Button>
              <Button type="button" variant="outline" onClick={restoreTeamsDefaults} disabled={savingTeams || loading}><RotateCcw className="h-4 w-4" />Restaurar padrão</Button>
              <Button type="button" variant="outline" onClick={() => void sendTeamsTest(teamsType)} disabled={teamsBusy || teamsStatus?.connected !== true || !canSendTest}>
                <MessageSquare className="h-4 w-4" />
                Enviar esta mensagem de teste
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden border-slate-200 bg-[#EDEFF7] shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-white py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle className="text-base">Prévia do Teams</CardTitle><CardDescription className="mt-1">{teamsOption.label} · {teamsPreview.teams.label}</CardDescription></div>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button type="button" aria-label="Prévia desktop do Teams" onClick={() => setTeamsDevice('desktop')} className={cn('rounded-md p-2', teamsDevice === 'desktop' ? 'bg-white text-[#5B5FC7] shadow-sm' : 'text-slate-400')}><Monitor className="h-4 w-4" /></button>
              <button type="button" aria-label="Prévia mobile do Teams" onClick={() => setTeamsDevice('mobile')} className={cn('rounded-md p-2', teamsDevice === 'mobile' ? 'bg-white text-[#5B5FC7] shadow-sm' : 'text-slate-400')}><Smartphone className="h-4 w-4" /></button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-[760px] justify-center p-4 md:p-6">
          <div className={cn('overflow-hidden rounded-xl border border-[#5B5FC7]/25 bg-white shadow-xl transition-all duration-300', teamsDevice === 'mobile' ? 'w-[390px]' : 'w-full max-w-[760px]')}>
            <div className="flex items-center gap-2 bg-[#5B5FC7] px-4 py-3 text-white">
              <MessageSquareText className="h-4 w-4" />
              <span className="text-sm font-semibold tracking-wide">Microsoft Teams</span>
            </div>
            <TeamsAdaptiveCardPreview card={teamsPreview.teams.card} chatHtml={teamsPreview.teams.chatHtml} />
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
