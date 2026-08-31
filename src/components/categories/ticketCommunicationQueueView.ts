import type { TicketCommunicationType } from '@/services/ticketCommunicationSettingsService';
import type { TicketCommunicationQueueItem } from '@/services/ticketCommunicationService';

export type QueueTypeFilter = 'all' | TicketCommunicationType;
export type QueueChannelFilter = 'all' | 'email' | 'teams';

export const QUEUE_TYPE_BADGE_CLASS: Record<TicketCommunicationType, string> = {
  resolved_feedback_invite: 'border-[#F69F19]/35 bg-[#F69F19]/10 text-[#9A6A0A] hover:bg-[#F69F19]/10 hover:text-[#9A6A0A]',
  awaiting_requester: 'border-[#DE5532]/30 bg-[#DE5532]/10 text-[#DE5532] hover:bg-[#DE5532]/10 hover:text-[#DE5532]',
  awaiting_feedback: 'border-[#BD2D29]/30 bg-[#BD2D29]/10 text-[#BD2D29] hover:bg-[#BD2D29]/10 hover:text-[#BD2D29]',
};

export const QUEUE_CHANNEL_BADGE_CLASS: Record<'email' | 'teams', string> = {
  email: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50 hover:text-sky-700',
  teams: 'border-[#5B5FC7]/30 bg-[#5B5FC7]/10 text-[#5B5FC7] hover:bg-[#5B5FC7]/10 hover:text-[#5B5FC7]',
};

function matchesQuery(item: TicketCommunicationQueueItem, query?: string): boolean {
  const needle = query?.trim().toLowerCase();
  if (!needle) return true;
  return [item.ticketTitle, item.requesterName, item.requesterEmail]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export function filterQueueItems(
  items: TicketCommunicationQueueItem[],
  filters: { type?: QueueTypeFilter; channel?: QueueChannelFilter; query?: string } = {},
): TicketCommunicationQueueItem[] {
  return items.filter((item) => {
    if (filters.type && filters.type !== 'all' && item.notificationType !== filters.type) return false;
    if (filters.channel && filters.channel !== 'all' && item.channel !== filters.channel) return false;
    return matchesQuery(item, filters.query);
  });
}

const TIME_ZONE = 'America/Sao_Paulo';

export type QueueDayGroup = {
  key: string;
  label: string;
  items: TicketCommunicationQueueItem[];
};

export type QueueMonthGroup = {
  key: string;
  label: string;
  days: QueueDayGroup[];
};

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function shiftDayKey(key: string, delta: number): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

function parseDayKey(key: string): Date {
  return new Date(`${key}T12:00:00.000-03:00`);
}

export function itemTimestamp(item: TicketCommunicationQueueItem): Date {
  if (item.sentAt) {
    const sent = new Date(item.sentAt);
    if (Number.isFinite(sent.getTime())) return sent;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(item.cycleKey)) {
    return parseDayKey(item.cycleKey);
  }
  const cycle = Date.parse(item.cycleKey);
  if (Number.isFinite(cycle)) return new Date(cycle);
  return new Date();
}

function formatDayHeading(key: string, now: Date): string {
  const today = dayKey(now);
  if (key === today) return 'Hoje';
  if (key === shiftDayKey(today, -1)) return 'Ontem';
  const date = parseDayKey(key);
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: TIME_ZONE,
  }).format(date);
}

function formatMonthHeading(monthKey: string): string {
  const date = parseDayKey(`${monthKey}-01`);
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function groupQueueItemsByMonthAndDay(
  items: TicketCommunicationQueueItem[],
  now = new Date(),
): QueueMonthGroup[] {
  const days = new Map<string, TicketCommunicationQueueItem[]>();
  for (const item of items) {
    const key = dayKey(itemTimestamp(item));
    const bucket = days.get(key) ?? [];
    bucket.push(item);
    days.set(key, bucket);
  }

  const months = new Map<string, QueueDayGroup[]>();
  for (const key of [...days.keys()].sort((left, right) => right.localeCompare(left))) {
    const monthKey = key.slice(0, 7);
    const day: QueueDayGroup = {
      key,
      label: formatDayHeading(key, now),
      items: days.get(key) ?? [],
    };
    const bucket = months.get(monthKey) ?? [];
    bucket.push(day);
    months.set(monthKey, bucket);
  }

  return [...months.entries()].map(([key, groupedDays]) => ({
    key,
    label: formatMonthHeading(key),
    days: groupedDays,
  }));
}
