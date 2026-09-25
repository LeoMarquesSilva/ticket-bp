import type { FC } from 'react';
import { ClipboardList } from 'lucide-react';
import type { TransferHandoff } from '@/utils/transferHandoff';

interface TransferHandoffNoteProps {
  handoff: TransferHandoff;
  compact?: boolean;
}

const TransferHandoffNote: FC<TransferHandoffNoteProps> = ({ handoff, compact = false }) => {
  const fromName = handoff.fromName || 'atendente anterior';
  const toName = handoff.toName || 'próximo atendente';

  return (
    <div
      className={
        compact
          ? 'rounded-lg border border-[#F69F19]/30 bg-[#F69F19]/10 px-3 py-2'
          : 'mx-auto w-full max-w-lg rounded-xl border border-[#F69F19]/35 bg-[#FFF8EE] px-3 py-2.5 shadow-sm'
      }
    >
      <div className="flex items-start gap-2">
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-[#DE5532]" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#DE5532]">
            Orientações para o próximo atendente
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            De {fromName} para {toName}
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {handoff.note}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TransferHandoffNote;
