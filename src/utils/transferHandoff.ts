export const TRANSFER_HANDOFF_MARKER = '[[transfer-handoff]]';

export interface TransferHandoff {
  fromName: string;
  toName: string;
  note: string;
}

export function buildTransferHandoffMessage(handoff: TransferHandoff): string {
  return `${TRANSFER_HANDOFF_MARKER}\n${JSON.stringify({
    fromName: handoff.fromName.trim(),
    toName: handoff.toName.trim(),
    note: handoff.note.trim(),
  })}`;
}

export function parseTransferHandoffMessage(message: string): TransferHandoff | null {
  if (!message.startsWith(TRANSFER_HANDOFF_MARKER)) return null;
  const raw = message.slice(TRANSFER_HANDOFF_MARKER.length).trim();
  try {
    const parsed = JSON.parse(raw) as Partial<TransferHandoff>;
    if (typeof parsed.note !== 'string' || !parsed.note.trim()) return null;
    return {
      fromName: typeof parsed.fromName === 'string' ? parsed.fromName.trim() : '',
      toName: typeof parsed.toName === 'string' ? parsed.toName.trim() : '',
      note: parsed.note.trim(),
    };
  } catch {
    return null;
  }
}

export function findLatestTransferHandoff(
  messages: Array<{ message: string }>,
): TransferHandoff | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const parsed = parseTransferHandoffMessage(messages[i].message);
    if (parsed) return parsed;
  }
  return null;
}
