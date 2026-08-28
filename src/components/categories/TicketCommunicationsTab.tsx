import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Eye, Link2, Loader2, Mail, MessageSquareText, Monitor, RotateCcw, Save, Smartphone, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  EMAIL_TEMPLATE_DEFAULTS,
  buildNotificationContent,
} from '../../../supabase/functions/notify-ticket-communications/_shared/templates.mjs';
import {
  TicketCommunicationSettingsService,
  type TicketCommunicationTemplateOverrides,
  type TicketCommunicationType,
} from '@/services/ticketCommunicationSettingsService';
import {
  TicketCommunicationTeamsService,
  type TicketCommunicationTeamsStatus,
} from '@/services/ticketCommunicationTeamsService';

const OPTIONS: Array<{
  type: TicketCommunicationType;
  label: string;
  caption: string;
  icon: typeof Mail;
  accent: string;
}> = [
  { type: 'resolved_feedback_invite', label: 'Chamado finalizado', caption: 'Convite imediato para avaliação', icon: CheckCircle2, accent: '#F69F19' },
  { type: 'awaiting_requester', label: 'Aguardando resposta', caption: 'Lembrete após 48 horas', icon: Clock3, accent: '#DE5532' },
  { type: 'awaiting_feedback', label: 'Avaliação pendente', caption: 'Lembrete após 72 horas', icon: Eye, accent: '#BD2D29' },
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
  const [settings, setSettings] = useState<TicketCommunicationTemplateOverrides>({});
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teamsStatus, setTeamsStatus] = useState<TicketCommunicationTeamsStatus | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsBusy, setTeamsBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    TicketCommunicationSettingsService.get()
      .then((value) => { if (alive) setSettings(value); })
      .catch(() => toast.error('Não foi possível carregar os textos dos e-mails.'))
      .finally(() => { if (alive) setLoading(false); });
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
  const activeOption = OPTIONS.find((option) => option.type === activeType)!;
  const preview = useMemo(() => buildNotificationContent({
    type: activeType,
    ticket: SAMPLE_TICKET,
    requester: { name: 'Leonardo' },
    appBaseUrl: 'https://responsum.example',
    emailTemplateOverrides: settings,
  }), [activeType, settings]);

  function updateField(field: 'subject' | 'reason' | 'action', value: string) {
    setSettings((current) => ({
      ...current,
      [activeType]: { ...(current[activeType] ?? {}), [field]: value },
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

  return (
    <div className="space-y-5">
      <TeamsConnectionCard
        loading={teamsLoading}
        busy={teamsBusy}
        status={teamsStatus}
        onConnect={() => void connectTeams()}
        onDisconnect={() => void disconnectTeams()}
      />
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
                    <span><span className="block text-sm font-semibold text-[#2C2D2F]">{option.label}</span><span className="mt-0.5 block text-xs text-slate-500">{option.caption}</span></span>
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
    </div>
  );
}
