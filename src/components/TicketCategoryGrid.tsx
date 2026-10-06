import React from 'react';
import { ChevronRight, Folder, FolderOpen, X } from 'lucide-react';
import type { Ticket } from '@/types';
import {
  getTicketCategoryColumnCount,
  groupTicketCategoryRows,
  type TicketCategoryGroup,
} from '@/utils/ticketCategoryGroups';

interface TicketCategoryGridProps {
  categories: TicketCategoryGroup<Ticket>[];
  expandedCategories: ReadonlySet<string>;
  onToggleCategory: (key: string, button: HTMLButtonElement) => void;
  renderTicketCard: (ticket: Ticket) => React.ReactNode;
  isChatOpen: boolean;
  idPrefix: string;
}

export default function TicketCategoryGrid({
  categories, expandedCategories, onToggleCategory, renderTicketCard, isChatOpen, idPrefix,
}: TicketCategoryGridProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [columns, setColumns] = React.useState<1 | 2 | 3>(1);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setColumns(getTicketCategoryColumnCount(container.clientWidth, isChatOpen));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isChatOpen]);

  const rows = groupTicketCategoryRows(categories, columns);
  const headingId = (key: string) => `${idPrefix}-category-heading-${encodeURIComponent(key)}`;
  const panelId = (key: string) => `${idPrefix}-category-panel-${encodeURIComponent(key)}`;

  return (
    <div ref={containerRef} className="space-y-3">
      {rows.map((row) => (
        <div key={row[0].key} className="space-y-3">
          <div className="ticket-category-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {row.map((category) => {
              const isExpanded = expandedCategories.has(category.key);
              const CategoryIcon = isExpanded ? FolderOpen : Folder;
              const countLabel = `${category.tickets.length} ${category.tickets.length === 1 ? 'ticket' : 'tickets'}`;
              return (
                <h3
                  key={category.key}
                  id={headingId(category.key)}
                  className={`ticket-category min-w-0 overflow-hidden rounded-xl border ${isExpanded ? 'border-slate-400 bg-slate-100' : 'border-slate-200 bg-white'}`}
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={panelId(category.key)}
                    onClick={(event) => onToggleCategory(category.key, event.currentTarget)}
                    className={`ticket-category-toggle ${isChatOpen ? 'ticket-category-toggle--chat' : ''} w-full text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F69F19]`}
                  >
                    <span className={`ticket-category-icon flex h-7 w-7 items-center justify-center rounded-md ${isExpanded ? 'bg-white text-[#DE5532]' : 'bg-slate-100 text-slate-500'}`}>
                      <CategoryIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="ticket-category-title min-w-0 text-base font-bold leading-snug text-[#2C2D2F]" title={category.label}>
                      {category.label}
                    </span>
                    <span
                      className={`ticket-category-count inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${isExpanded ? 'bg-[#DE5532] text-white' : 'bg-slate-100 text-slate-700'}`}
                      aria-label={countLabel}
                      title={countLabel}
                    >
                      {category.tickets.length}
                    </span>
                    <ChevronRight className={`ticket-category-chevron h-4 w-4 text-slate-500 transition-transform duration-200 motion-reduce:transition-none ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true" />
                  </button>
                </h3>
              );
            })}
          </div>

          {row.filter((category) => expandedCategories.has(category.key)).map((category) => (
            <div
              key={category.key}
              id={panelId(category.key)}
              role="region"
              aria-labelledby={headingId(category.key)}
              className="ticket-category-panel min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <div className={`flex items-center gap-2 border-b border-slate-200 bg-slate-50 ${isChatOpen ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                <FolderOpen className="h-4 w-4 shrink-0 text-[#DE5532]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#2C2D2F]" title={category.label}>
                  {category.label}
                </span>
                <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#DE5532] px-1.5 text-[11px] font-bold text-white">
                  {category.tickets.length}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    const toggle = document.getElementById(headingId(category.key))?.querySelector('button');
                    onToggleCategory(category.key, toggle ?? event.currentTarget);
                    toggle?.focus({ preventScroll: true });
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19]"
                  aria-label={`Recolher ${category.label}`}
                  title="Recolher"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className={`ticket-list-grid grid auto-rows-max ${isChatOpen ? 'ticket-list-grid--chat gap-2 p-2' : 'gap-3 p-3'}`}>
                {category.tickets.map((ticket) => (
                  <div key={ticket.id} className="min-w-0 h-full">{renderTicketCard(ticket)}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
