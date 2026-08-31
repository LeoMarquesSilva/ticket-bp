import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Clock3, ExternalLink, Eye, Inbox, Link2, ListChecks, Loader2, Mail, MessageSquare, MessageSquareText, Monitor, RefreshCw, RotateCcw, Save, Search, Send, Smartphone, Unplug, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useOfficialPhoto } from '@/contexts/OfficialPhotosContext';
import { officialPhotoSrc } from '@/services/officialPhotosService';
import {
  filterQueueItems,
  groupQueueItemsByMonthAndDay,
  QUEUE_CHANNEL_BADGE_CLASS,
  QUEUE_TYPE_BADGE_CLASS,
  type QueueChannelFilter,
  type QueueTypeFilter,
} from './ticketCommunicationQueueView';
import { cn } from '@/lib/utils';
import {
  formatScheduleCaption,
  normalizeSchedule,
  SCHEDULE_DEFAULTS,
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
import {
  getTicketCommunicationQueue,
  retryTicketCommunication,
  runPendingTicketCommunications,
  type TicketCommunicationQueue,
  type TicketCommunicationQueueItem,
} from '@/services/ticketCommunicationService';
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

const TYPE_LABELS: Record<TicketCommunicationType, string> = {
  resolved_feedback_invite: 'Chamado finalizado',
  awaiting_requester: 'Aguardando resposta',
  awaiting_feedback: 'Avaliação pendente',
};

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function formatTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function initials(name?: string): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function deliveryErrorLabel(code: string | null): string | null {
  if (!code) return null;
  if (code === 'entra_user_not_found') return 'Usuário não encontrado no Microsoft 365';
  return 'Falha no envio';
}

function queueItemKey(item: TicketCommunicationQueueItem): string {
  return `${item.ticketId}-${item.notificationType}-${item.channel}-${item.cycleKey}`;
}

function QueueRow({
  item,
  showTime,
  busy,
  retrying,
  onPreview,
  onRetry,
}: {
  item: TicketCommunicationQueueItem;
  showTime?: boolean;
  busy?: boolean;
  retrying?: boolean;
  onPreview: (item: TicketCommunicationQueueItem) => void;
  onRetry: (item: TicketCommunicationQueueItem) => void;
}) {
  const photo = useOfficialPhoto(item.requesterId);
  const src = officialPhotoSrc(photo);
  const displayName = item.requesterName || 'Solicitante';
  const sentAt = formatTime(item.sentAt);
  const error = deliveryErrorLabel(item.lastError);
  const ticketUrl = `/tickets/${item.ticketId}`;

  return (
    <div
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300"
      onClick={() => onPreview(item)}
    >
      <Avatar className="h-10 w-10 shrink-0 rounded-lg">
        {src && <AvatarImage src={src} alt={displayName} className="object-cover" />}
        <AvatarFallback className="rounded-lg bg-[#F69F19]/15 text-xs font-semibold text-[#DE5532]">
          {item.requesterName ? initials(item.requesterName) : <UserRound className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <a
            href={ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1 truncate text-sm font-semibold text-[#2C2D2F] hover:text-[#DE5532]"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="truncate">{item.ticketTitle}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="sr-only">Abrir chamado</span>
          </a>
          {showTime && sentAt && (
            <span className="shrink-0 text-[11px] text-slate-400" title={`Enviado às ${sentAt}`}>
              {sentAt}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500" title={item.requesterEmail || undefined}>
          {displayName}
          {item.requesterEmail ? ` · ${item.requesterEmail}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={QUEUE_TYPE_BADGE_CLASS[item.notificationType]}>
            {TYPE_LABELS[item.notificationType]}
          </Badge>
          <Badge variant="outline" className={QUEUE_CHANNEL_BADGE_CLASS[item.channel]}>
            {item.channel === 'teams'
              ? <><MessageSquareText className="mr-1 h-3 w-3" />Teams</>
              : <><Mail className="mr-1 h-3 w-3" />E-mail</>}
          </Badge>
          {item.status === 'failed' && <Badge variant="warning">{error ?? 'Falhou'}</Badge>}
          {item.status === 'processing' && <Badge variant="secondary">Enviando</Badge>}
          {item.status === 'pending' && <Badge variant="secondary">Pendente</Badge>}
          {item.status === 'failed' && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={busy || retrying}
              onClick={(event) => {
                event.stopPropagation();
                onRetry(item);
              }}
            >
              {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Reenviar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function QueueItemPreview({
  item,
  busy,
  retrying,
  onRetry,
}: {
  item: TicketCommunicationQueueItem;
  busy?: boolean;
  retrying?: boolean;
  onRetry: (item: TicketCommunicationQueueItem) => void;
}) {
  const photo = useOfficialPhoto(item.requesterId);
  const src = officialPhotoSrc(photo);
  const displayName = item.requesterName || 'Solicitante';
  const sentAt = formatDateTime(item.sentAt);
  const error = deliveryErrorLabel(item.lastError);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 shrink-0 rounded-lg">
          {src && <AvatarImage src={src} alt={displayName} className="object-cover" />}
          <AvatarFallback className="rounded-lg bg-[#F69F19]/15 text-sm font-semibold text-[#DE5532]">
            {item.requesterName ? initials(item.requesterName) : <UserRound className="h-5 w-5" />}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#2C2D2F]">{displayName}</p>
          {item.requesterEmail && <p className="truncate text-xs text-slate-500">{item.requesterEmail}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className={QUEUE_TYPE_BADGE_CLASS[item.notificationType]}>
          {TYPE_LABELS[item.notificationType]}
        </Badge>
        <Badge variant="outline" className={QUEUE_CHANNEL_BADGE_CLASS[item.channel]}>
          {item.channel === 'teams' ? 'Teams' : 'E-mail'}
        </Badge>
        {item.status === 'failed' && <Badge variant="warning">{error ?? 'Falhou'}</Badge>}
        {item.status === 'pending' && <Badge variant="secondary">Pendente</Badge>}
        {item.status === 'sent' && <Badge variant="success">Enviado</Badge>}
      </div>
      {sentAt && <p className="text-sm text-slate-600">Enviado em {sentAt}</p>}
      {item.status === 'failed' && error && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</p>
      )}
      <SheetFooter className="flex-col gap-2 sm:flex-col">
        <Button asChild className="w-full">
          <a href={`/tickets/${item.ticketId}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Abrir chamado
          </a>
        </Button>
        {item.status === 'failed' && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy || retrying}
            onClick={() => onRetry(item)}
          >
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Reenviar este aviso
          </Button>
        )}
      </SheetFooter>
    </div>
  );
}

function QueueState({
  tone,
  title,
  description,
}: {
  tone: 'loading' | 'error' | 'empty';
  title: string;
  description?: ReactNode;
}) {
  const Icon = tone === 'loading' ? Loader2 : tone === 'error' ? RefreshCw : Inbox;
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 rounded-xl border px-4 py-8 text-center',
        tone === 'error'
          ? 'border-rose-200 bg-rose-50/80'
          : 'border-dashed border-slate-200 bg-slate-50/70',
      )}
    >
      <Icon className={cn(
        'h-5 w-5',
        tone === 'loading' && 'animate-spin text-slate-400',
        tone === 'error' && 'text-rose-500',
        tone === 'empty' && 'text-slate-400',
      )} />
      <p className={cn('text-sm', tone === 'error' ? 'font-medium text-rose-700' : 'text-slate-500')}>
        {title}
      </p>
      {description && <p className="text-xs text-slate-400">{description}</p>}
    </div>
  );
}

const TYPE_FILTERS: Array<{ value: QueueTypeFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'resolved_feedback_invite', label: 'Finalizado' },
  { value: 'awaiting_requester', label: 'Aguardando' },
  { value: 'awaiting_feedback', label: 'Avaliação' },
];

const CHANNEL_FILTERS: Array<{ value: QueueChannelFilter; label: string }> = [
  { value: 'all', label: 'Todos os canais' },
  { value: 'email', label: 'E-mail' },
  { value: 'teams', label: 'Teams' },
];

function QueueFilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'border-[#2C2D2F] bg-[#2C2D2F] text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}

function QueueGroupedList({
  items,
  showTime,
  busy,
  retryingKey,
  onPreview,
  onRetry,
}: {
  items: TicketCommunicationQueueItem[];
  showTime?: boolean;
  busy?: boolean;
  retryingKey?: string | null;
  onPreview: (item: TicketCommunicationQueueItem) => void;
  onRetry: (item: TicketCommunicationQueueItem) => void;
}) {
  const groups = groupQueueItemsByMonthAndDay(items);
  const currentMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()).slice(0, 7);
  return (
    <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
      {groups.map((month) => (
        <div key={month.key} className="space-y-3">
          {(groups.length > 1 || month.key !== currentMonth) && (
            <p className="sticky top-0 z-10 bg-white/95 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {month.label}
            </p>
          )}
          {month.days.map((day) => (
            <div key={day.key} className="space-y-2">
              <div className="flex items-center gap-2 px-0.5">
                <p className="text-xs font-semibold text-[#2C2D2F]">{day.label}</p>
                <span className="text-[11px] text-slate-400">{day.items.length}</span>
              </div>
              {day.items.map((item) => (
                <QueueRow
                  key={queueItemKey(item)}
                  item={item}
                  showTime={showTime}
                  busy={busy}
                  retrying={retryingKey === queueItemKey(item)}
                  onPreview={onPreview}
                  onRetry={onRetry}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TicketCommunicationQueueCard({
  loading,
  busy,
  queue,
  retryingKey,
  onRefresh,
  onRunPending,
  onRetry,
}: {
  loading: boolean;
  busy: boolean;
  queue: TicketCommunicationQueue | null;
  retryingKey?: string | null;
  onRefresh: () => void;
  onRunPending: () => void;
  onRetry?: (item: TicketCommunicationQueueItem) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<QueueTypeFilter>('all');
  const [channelFilter, setChannelFilter] = useState<QueueChannelFilter>('all');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<TicketCommunicationQueueItem | null>(null);
  const nextRunAt = formatDateTime(queue?.nextRunAt);
  const pendingCount = queue?.counts.next ?? 0;
  const sentCount = queue?.counts.sent ?? 0;
  const filters = { type: typeFilter, channel: channelFilter, query };
  const visibleNext = filterQueueItems(queue?.next ?? [], filters);
  const visibleSent = filterQueueItems(queue?.sent ?? [], filters);
  const hasFilter = typeFilter !== 'all' || channelFilter !== 'all' || query.trim() !== '';
  const retryItem = onRetry ?? (() => undefined);

  return (
    <>
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="h-1 bg-gradient-to-r from-[#F69F19] via-[#DE5532] to-[#BD2D29]" />
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg text-[#2C2D2F]">
              <span className="rounded-lg bg-[#2C2D2F] p-2 text-white"><Inbox className="h-4 w-4" /></span>
              Fila de avisos
            </CardTitle>
            <CardDescription className="mt-1.5">
              Veja o que já saiu e o que entra na próxima rotina
              {nextRunAt ? ` (${nextRunAt})` : ' (por volta das 9h, Brasília)'}.
              O botão envia agora para quem já venceu o prazo e ainda não recebeu.
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onRefresh} disabled={loading || busy}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </Button>
            <Button type="button" onClick={onRunPending} disabled={loading || busy || pendingCount === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar pendentes agora
            </Button>
          </div>
        </div>
        {queue && (queue.next.length > 0 || queue.sent.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {TYPE_FILTERS.map((filter) => (
              <QueueFilterChip
                key={filter.value}
                active={typeFilter === filter.value}
                onClick={() => setTypeFilter(filter.value)}
              >
                {filter.label}
              </QueueFilterChip>
            ))}
            <span className="mx-1 hidden h-4 w-px bg-slate-200 sm:block" />
            {CHANNEL_FILTERS.map((filter) => (
              <QueueFilterChip
                key={filter.value}
                active={channelFilter === filter.value}
                onClick={() => setChannelFilter(filter.value)}
              >
                {filter.label}
              </QueueFilterChip>
            ))}
            <div className="relative w-full sm:ml-auto sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar chamado ou solicitante"
                className="h-8 pl-9"
              />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#2C2D2F]">
              <ListChecks className="h-4 w-4 text-[#DE5532]" />
              Próxima rodada
            </h3>
            <Badge variant="secondary">{hasFilter ? visibleNext.length : pendingCount}</Badge>
          </div>
          {loading && !queue ? (
            <QueueState tone="loading" title="Carregando fila..." />
          ) : !queue ? (
            <QueueState
              tone="error"
              title="Não foi possível carregar a próxima rodada. Clique em Atualizar."
              description="A lista depende da conexão com o serviço de avisos."
            />
          ) : queue.next.length === 0 ? (
            <QueueState
              tone="empty"
              title="Nenhum aviso pendente agora."
              description="Quando o prazo vencer, o chamado aparece aqui."
            />
          ) : visibleNext.length === 0 ? (
            <QueueState
              tone="empty"
              title="Nenhum aviso neste filtro."
              description="Tire o filtro ou escolha outro tipo e canal."
            />
          ) : (
            <QueueGroupedList
              items={visibleNext}
              busy={busy}
              retryingKey={retryingKey}
              onPreview={setPreview}
              onRetry={retryItem}
            />
          )}
        </section>
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#2C2D2F]">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Enviados
            </h3>
            <Badge variant="secondary">{hasFilter ? visibleSent.length : sentCount}</Badge>
          </div>
          {loading && !queue ? (
            <QueueState tone="loading" title="Carregando histórico..." />
          ) : !queue ? (
            <QueueState
              tone="error"
              title="Não foi possível carregar os envios. Clique em Atualizar."
              description="O histórico de e-mail e Teams aparece depois do envio."
            />
          ) : queue.sent.length === 0 ? (
            <QueueState
              tone="empty"
              title="Nenhum envio recente."
              description="Os avisos já disparados ficam agrupados por dia."
            />
          ) : visibleSent.length === 0 ? (
            <QueueState
              tone="empty"
              title="Nenhum envio neste filtro."
              description="Tire o filtro ou escolha outro tipo e canal."
            />
          ) : (
            <QueueGroupedList
              items={visibleSent}
              showTime
              busy={busy}
              retryingKey={retryingKey}
              onPreview={setPreview}
              onRetry={retryItem}
            />
          )}
        </section>
      </CardContent>
    </Card>
    <Sheet open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="pr-6 text-left">{preview?.ticketTitle ?? 'Aviso'}</SheetTitle>
          <SheetDescription className="text-left">
            Detalhes do aviso sem sair da fila.
          </SheetDescription>
        </SheetHeader>
        {preview && (
          <div className="mt-6">
            <QueueItemPreview
              item={preview}
              busy={busy}
              retrying={retryingKey === queueItemKey(preview)}
              onRetry={retryItem}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
}

export default function TicketCommunicationsTab() {
  const [activeType, setActiveType] = useState<TicketCommunicationType>('resolved_feedback_invite');
  const [teamsType, setTeamsType] = useState<TicketCommunicationType>('resolved_feedback_invite');
  const [settings, setSettings] = useState<TicketCommunicationTemplateOverrides>({});
  const [teamsSettings, setTeamsSettings] = useState<TicketCommunicationTemplateOverrides>({});
  const [schedule, setSchedule] = useState<TicketCommunicationSchedule>(() => normalizeSchedule(SCHEDULE_DEFAULTS));
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
  const [queue, setQueue] = useState<TicketCommunicationQueue | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueBusy, setQueueBusy] = useState(false);
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const [confirmRun, setConfirmRun] = useState(false);

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

  async function loadQueue() {
    setQueueLoading(true);
    try {
      setQueue(await getTicketCommunicationQueue());
    } catch {
      toast.error('Não foi possível carregar a fila de avisos.');
    } finally {
      setQueueLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    setQueueLoading(true);
    getTicketCommunicationQueue()
      .then((value) => { if (alive) setQueue(value); })
      .catch(() => { if (alive) toast.error('Não foi possível carregar a fila de avisos.'); })
      .finally(() => { if (alive) setQueueLoading(false); });
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

  async function retryOne(item: TicketCommunicationQueueItem) {
    setRetryingKey(queueItemKey(item));
    try {
      const result = await retryTicketCommunication({
        ticketId: item.ticketId,
        notificationType: item.notificationType,
        channel: item.channel,
        cycleKey: item.cycleKey,
      });
      await loadQueue();
      if (result.sent > 0) toast.success('Aviso reenviado.');
      else if (result.failed > 0) toast.error('O reenvio falhou de novo.');
      else toast.success('Aviso recolocado na fila.');
    } catch {
      toast.error('Não foi possível reenviar este aviso.');
    } finally {
      setRetryingKey(null);
    }
  }

  async function runPending() {
    setConfirmRun(false);
    setQueueBusy(true);
    try {
      const result = await runPendingTicketCommunications();
      await loadQueue();
      if (result.sent === 0 && result.failed === 0) {
        toast.success('Não havia avisos pendentes para enviar.');
      } else {
        toast.success(`Enviados: ${result.sent}. Falhas: ${result.failed}.`);
      }
    } catch {
      toast.error('Não foi possível enviar os avisos pendentes.');
    } finally {
      setQueueBusy(false);
    }
  }

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
      <TicketCommunicationQueueCard
        loading={queueLoading}
        busy={queueBusy}
        queue={queue}
        retryingKey={retryingKey}
        onRefresh={() => void loadQueue()}
        onRunPending={() => setConfirmRun(true)}
        onRetry={(item) => void retryOne(item)}
      />
      <AlertDialog open={confirmRun} onOpenChange={setConfirmRun}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar avisos pendentes agora?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso envia e-mail e Teams reais para quem já venceu o prazo e ainda não recebeu neste ciclo.
              {queue?.counts.next ? ` Há ${queue.counts.next} aviso(s) na fila.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={queueBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runPending()} disabled={queueBusy}>
              Enviar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
