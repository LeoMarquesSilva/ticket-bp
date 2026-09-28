import { useEffect, useLayoutEffect, useRef, useState, type FC } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TicketDescriptionCardProps {
  description?: string | null;
  authorName?: string;
  className?: string;
}

const TicketDescriptionCard: FC<TicketDescriptionCardProps> = ({ description, authorName, className }) => {
  const text = String(description ?? '').replace(/\r\n/g, '\n').trim();
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const bodyRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || expanded) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded]);

  if (!text) return null;

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-2xl rounded-xl border border-[#DE5532]/20 bg-gradient-to-br from-[#FDEEE8] to-[#FFF9F6] px-3.5 py-3 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#DE5532]/15">
          <FileText className="h-3 w-3 text-[#DE5532]" />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#B74426]">
          Descrição do chamado
        </p>
        {authorName && (
          <span className="min-w-0 truncate text-[11px] text-[#B74426]/60">· {authorName}</span>
        )}
      </div>
      <p
        ref={bodyRef}
        className={cn(
          'mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[#2C2D2F] [overflow-wrap:anywhere]',
          !expanded && 'line-clamp-4',
        )}
      >
        {text}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#B74426] transition-colors hover:text-[#DE5532]"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Ver descrição completa
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default TicketDescriptionCard;
