import React from 'react';
import {
  ArrowDownUp,
  ChevronRight,
  Folder,
  FolderOpen,
  Inbox,
  LayoutList,
  MessageCircle,
  Reply,
  SearchX,
  UserX,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  matchesQuickFilter,
  sortTickets,
  TICKET_SORT_OPTIONS,
  type TicketQuickFilter,
  type TicketSortOrder,
} from '@/utils/ticketListQuickFilters';
import { Ticket } from '@/types';
import { FrenteIcon } from '@/components/FrenteIcon';
import TicketCategoryGrid from '@/components/TicketCategoryGrid';
import type { CategoriesConfigMap } from '@/utils/ticketFilterUtils';
import {
  groupTicketsByCategory,
  groupTicketsByFrente,
  type TicketCategoryGroup,
  type TicketFrenteDefinition,
} from '@/utils/ticketCategoryGroups';

const FRENTE_GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
};

const EXPANDED_FRENTE_STYLE: React.CSSProperties = { gridColumn: '1 / -1' };

type StatusBucket = 'open' | 'in_progress' | 'resolved';

const STATUS_SEGMENTS: { key: StatusBucket; singular: string; plural: string; barClass: string }[] = [
  { key: 'open', singular: 'aberto', plural: 'abertos', barClass: 'bg-[#F69F19]' },
  { key: 'in_progress', singular: 'em andamento', plural: 'em andamento', barClass: 'bg-[#DE5532]' },
  { key: 'resolved', singular: 'resolvido', plural: 'resolvidos', barClass: 'bg-slate-400' },
];

function countTicketsByStatus(categories: TicketCategoryGroup<Ticket>[]): Record<StatusBucket, number> {
  const counts: Record<StatusBucket, number> = { open: 0, in_progress: 0, resolved: 0 };
  categories.forEach((category) => {
    category.tickets.forEach((ticket) => {
      if (ticket.status === 'resolved') counts.resolved += 1;
      else if (ticket.status === 'in_progress') counts.in_progress += 1;
      else counts.open += 1;
    });
  });
  return counts;
}

interface TicketListProps {
  filteredTickets: Ticket[];
  tickets: Ticket[];
  categoriesConfig: CategoriesConfigMap;
  frentes?: TicketFrenteDefinition[];
  groupByFrente?: boolean;
  expandedFrenteKeys?: string[];
  onExpandedFrenteKeysChange?: (keys: string[]) => void;
  expandedCategoryKeys: string[];
  onExpandedCategoryKeysChange: (keys: string[]) => void;
  renderTicketCard: (ticket: Ticket) => React.ReactNode;
  isChatOpen?: boolean;
  unreadCounts?: Record<string, number>;
  /** Autor da última mensagem por ticket; habilita o filtro "Aguardando resposta" (só equipe). */
  lastMessageAuthors?: Record<string, string>;
}

const NO_UNREAD: Record<string, number> = {};

const SORT_STORAGE_KEY = 'responsum.ticketList.sort';

const QUICK_FILTER_OPTIONS: { value: TicketQuickFilter; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'Todos', icon: LayoutList },
  { value: 'unread', label: 'Não lidas', icon: MessageCircle },
  { value: 'awaiting_reply', label: 'Aguardando resposta', icon: Reply },
  { value: 'unassigned', label: 'Sem atendente', icon: UserX },
];

function readStoredSortOrder(): TicketSortOrder {
  try {
    const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (TICKET_SORT_OPTIONS.some((option) => option.value === stored)) return stored as TicketSortOrder;
  } catch {
    // armazenamento indisponível
  }
  return 'recent';
}

const TicketList: React.FC<TicketListProps> = ({
  filteredTickets,
  tickets,
  categoriesConfig,
  frentes = [],
  groupByFrente = false,
  expandedFrenteKeys = [],
  onExpandedFrenteKeysChange,
  expandedCategoryKeys,
  onExpandedCategoryKeysChange,
  renderTicketCard,
  isChatOpen = false,
  unreadCounts = NO_UNREAD,
  lastMessageAuthors,
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const scrollAnchorRef = React.useRef<{ element: HTMLElement; top: number } | null>(null);
  const preserveScrollPosition = (element: HTMLElement) => {
    scrollAnchorRef.current = { element, top: element.getBoundingClientRect().top };
  };

  React.useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current;
    const container = scrollContainerRef.current;
    scrollAnchorRef.current = null;
    if (anchor?.element.isConnected && container) {
      container.scrollTop += anchor.element.getBoundingClientRect().top - anchor.top;
    }
  }, [expandedCategoryKeys, expandedFrenteKeys]);

  // Verifica se a lista está vazia por filtro ou por não existir tickets
  const isFilteredEmpty = tickets.length > 0 && filteredTickets.length === 0;
  const isTotalEmpty = tickets.length === 0;
  const [quickFilter, setQuickFilter] = React.useState<TicketQuickFilter>('all');
  const [sortOrder, setSortOrder] = React.useState<TicketSortOrder>(readStoredSortOrder);
  const quickFilterContext = React.useMemo(
    () => ({ unreadCounts, lastMessageAuthors }),
    [unreadCounts, lastMessageAuthors],
  );
  const quickFilterCounts = React.useMemo(() => {
    const counts: Record<TicketQuickFilter, number> = { all: filteredTickets.length, unread: 0, awaiting_reply: 0, unassigned: 0 };
    filteredTickets.forEach((ticket) => {
      (['unread', 'awaiting_reply', 'unassigned'] as const).forEach((filter) => {
        if (matchesQuickFilter(ticket, filter, quickFilterContext)) counts[filter] += 1;
      });
    });
    return counts;
  }, [filteredTickets, quickFilterContext]);
  const displayedTickets = React.useMemo(
    () => sortTickets(
      filteredTickets.filter((ticket) => matchesQuickFilter(ticket, quickFilter, quickFilterContext)),
      sortOrder,
    ),
    [filteredTickets, quickFilter, quickFilterContext, sortOrder],
  );
  const categoryGroups = React.useMemo(
    () => groupTicketsByCategory(displayedTickets, categoriesConfig),
    [categoriesConfig, displayedTickets],
  );
  const frenteGroups = React.useMemo(
    () => groupTicketsByFrente(displayedTickets, categoriesConfig, frentes),
    [categoriesConfig, displayedTickets, frentes],
  );

  const quickFilterOptions = QUICK_FILTER_OPTIONS.filter(
    (option) => option.value !== 'awaiting_reply' || lastMessageAuthors !== undefined,
  );

  const handleQuickFilterChange = (filter: TicketQuickFilter) => {
    const next = quickFilter === filter ? 'all' : filter;
    setQuickFilter(next);
    if (next === 'all') return;
    const matching = filteredTickets.filter((ticket) => matchesQuickFilter(ticket, next, quickFilterContext));
    onExpandedCategoryKeysChange([
      ...new Set([...expandedCategoryKeys, ...groupTicketsByCategory(matching, categoriesConfig).map((group) => group.key)]),
    ]);
    if (groupByFrente) {
      onExpandedFrenteKeysChange?.([
        ...new Set([...expandedFrenteKeys, ...groupTicketsByFrente(matching, categoriesConfig, frentes).map((group) => group.key)]),
      ]);
    }
  };

  const handleSortOrderChange = (value: string) => {
    const order = value as TicketSortOrder;
    setSortOrder(order);
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, order);
    } catch {
      // armazenamento indisponível
    }
  };
  const expandedCategories = React.useMemo(
    () => new Set(expandedCategoryKeys),
    [expandedCategoryKeys],
  );
  const expandedFrentes = React.useMemo(
    () => new Set(expandedFrenteKeys),
    [expandedFrenteKeys],
  );
  const listId = React.useId().replace(/:/g, '');
  const allVisibleCategoriesExpanded = categoryGroups.every((group) => expandedCategories.has(group.key));
  const allVisibleFrentesExpanded = frenteGroups.every((group) => expandedFrentes.has(group.key));
  const allVisibleHierarchyExpanded = allVisibleCategoriesExpanded && (!groupByFrente || allVisibleFrentesExpanded);

  const toggleCategory = (categoryKey: string) => {
    if (expandedCategories.has(categoryKey)) {
      onExpandedCategoryKeysChange(expandedCategoryKeys.filter((key) => key !== categoryKey));
      return;
    }
    onExpandedCategoryKeysChange([...expandedCategoryKeys, categoryKey]);
  };

  const toggleFrente = (frenteKey: string) => {
    if (expandedFrentes.has(frenteKey)) {
      onExpandedFrenteKeysChange?.(expandedFrenteKeys.filter((key) => key !== frenteKey));
      return;
    }
    onExpandedFrenteKeysChange?.([...expandedFrenteKeys, frenteKey]);
  };

  const toggleAllCategories = () => {
    if (allVisibleHierarchyExpanded) {
      onExpandedCategoryKeysChange([]);
      onExpandedFrenteKeysChange?.([]);
      return;
    }

    onExpandedCategoryKeysChange([
      ...new Set([...expandedCategoryKeys, ...categoryGroups.map((group) => group.key)]),
    ]);
    if (groupByFrente) {
      onExpandedFrenteKeysChange?.([
        ...new Set([...expandedFrenteKeys, ...frenteGroups.map((group) => group.key)]),
      ]);
    }
  };

  const renderCategoryGroup = (
    group: TicketCategoryGroup<Ticket>,
    position: string,
  ) => {
    const isExpanded = expandedCategories.has(group.key);
    const headingId = `${listId}-category-heading-${position}`;
    const panelId = `${listId}-category-panel-${position}`;
    const ticketCountLabel = `${group.tickets.length} ${group.tickets.length === 1 ? 'ticket' : 'tickets'}`;
    const CategoryIcon = isExpanded ? FolderOpen : Folder;

    return (
      <section
        key={group.key}
        className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        aria-labelledby={headingId}
      >
        <h2 id={headingId}>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={panelId}
            onClick={(event) => {
              preserveScrollPosition(event.currentTarget);
              toggleCategory(group.key);
            }}
            className={`group flex min-h-12 w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F69F19] sm:px-4 ${isExpanded ? 'bg-slate-50' : ''}`}
          >
            <span className="ticket-category-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <CategoryIcon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="ticket-category-title min-w-0 flex-1 text-sm font-semibold leading-snug text-[#2C2D2F]" title={group.label}>
              {group.label}
            </span>
            <span
              className="ticket-category-count density-badge inline-flex min-w-7 shrink-0 items-center justify-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600"
              aria-label={ticketCountLabel}
            >
              <strong className="font-semibold text-slate-800">{group.tickets.length}</strong>
              <span>{group.tickets.length === 1 ? 'ticket' : 'tickets'}</span>
            </span>
            <ChevronRight
              className={`ticket-category-chevron h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 motion-reduce:transition-none ${isExpanded ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
          </button>
        </h2>

        {isExpanded && (
          <div
            id={panelId}
            role="region"
            aria-labelledby={headingId}
            className="border-t border-slate-200 bg-slate-50/60 p-2.5 sm:p-3"
          >
            <div
              className={`ticket-list-grid grid auto-rows-max ${isChatOpen ? 'ticket-list-grid--chat gap-2' : 'gap-3'}`}
            >
              {group.tickets.map((ticket) => (
                <div key={ticket.id} className="h-full">
                  {renderTicketCard(ticket)}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  };

  if (isTotalEmpty || isFilteredEmpty) {
    return (
      <div className={`h-full w-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-50/80 to-white ${isChatOpen ? 'p-4' : 'p-8'}`}>
        <div className={`flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300 ${isChatOpen ? 'max-w-[200px]' : 'max-w-sm'}`}>
          <div className={`bg-white rounded-full flex items-center justify-center shadow-md border border-slate-200 ring-2 ring-slate-100 ${isChatOpen ? 'h-14 w-14 mb-3' : 'h-20 w-20 mb-4'}`}>
            {isFilteredEmpty ? (
              <SearchX className={isChatOpen ? 'h-7 w-7 text-slate-300' : 'h-10 w-10 text-slate-300'} />
            ) : (
              <Inbox className={isChatOpen ? 'h-7 w-7 text-slate-300' : 'h-10 w-10 text-slate-300'} />
            )}
          </div>
          <h3 className={`font-semibold text-slate-700 mb-1 ${isChatOpen ? 'text-sm' : 'text-lg'}`}>
            {isFilteredEmpty ? 'Nenhum resultado' : 'Nenhum ticket'}
          </h3>
          <p className={isChatOpen ? 'text-xs text-slate-500' : 'text-sm text-slate-500'}>
            {isFilteredEmpty 
              ? 'Ajuste os filtros de busca.'
              : 'Não há tickets no momento.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="h-full w-full overflow-y-auto bg-gradient-to-b from-slate-50/80 to-white custom-scrollbar">
      <div className={isChatOpen ? 'p-2' : 'p-3 sm:p-4 lg:p-5'}>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label="Filtros rápidos">
            {quickFilterOptions.map((option) => {
              const active = quickFilter === option.value;
              const count = quickFilterCounts[option.value];
              const Icon = option.icon;
              const highlight = option.value !== 'all' && count > 0 && !active;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleQuickFilterChange(option.value)}
                  className={`density-meta inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19] ${
                    active
                      ? 'border-[#2C2D2F] bg-[#2C2D2F] text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? 'text-[#F69F19]' : 'text-slate-400'}`} aria-hidden="true" />
                  {option.label}
                  <span
                    className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      active
                        ? 'bg-white/15 text-white'
                        : highlight
                          ? 'bg-[#DE5532] text-white'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Select value={sortOrder} onValueChange={handleSortOrderChange}>
              <SelectTrigger
                className="density-meta h-8 w-auto gap-1.5 rounded-lg border-slate-200 bg-white px-2.5 font-medium text-slate-600"
                aria-label="Ordenar tickets"
              >
                <ArrowDownUp className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {TICKET_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={toggleAllCategories}
              className="density-meta min-h-8 shrink-0 rounded-lg px-2.5 font-semibold text-[#B74426] transition-colors hover:bg-[#DE5532]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19] focus-visible:ring-offset-2"
            >
              {allVisibleHierarchyExpanded ? 'Recolher todas' : 'Expandir todas'}
            </button>
          </div>
        </div>

        {displayedTickets.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
            <SearchX className="h-6 w-6 text-slate-300" aria-hidden="true" />
            <p className="text-sm text-slate-500">Nenhum ticket neste filtro.</p>
            <button
              type="button"
              onClick={() => setQuickFilter('all')}
              className="text-sm font-semibold text-[#B74426] hover:underline"
            >
              Ver todos
            </button>
          </div>
        )}

        <div
          className={groupByFrente
            ? `grid ${isChatOpen ? 'gap-2' : 'gap-3'} animate-in fade-in slide-in-from-bottom-4 duration-500`
            : 'space-y-2.5 animate-in fade-in slide-in-from-bottom-4 duration-500'}
          style={groupByFrente ? FRENTE_GRID_STYLE : undefined}
        >
          {groupByFrente
            ? frenteGroups.map((frente, frenteIndex) => {
                const isExpanded = expandedFrentes.has(frente.key);
                const headingId = `${listId}-frente-heading-${frenteIndex}`;
                const panelId = `${listId}-frente-panel-${frenteIndex}`;
                const frenteColor = /^#[0-9a-f]{6}$/i.test(frente.color || '') ? frente.color! : '#DE5532';
                const statusCounts = countTicketsByStatus(frente.categories);
                const sortedCategories = [...frente.categories].sort((a, b) => b.tickets.length - a.tickets.length);
                const topCategories = sortedCategories.slice(0, 3);
                const hiddenCategoryCount = sortedCategories.length - topCategories.length;
                const unreadTicketCount = frente.categories.reduce(
                  (total, category) => total + category.tickets.filter((ticket) => (unreadCounts[ticket.id] ?? 0) > 0).length,
                  0,
                );

                return (
                  <section
                    key={frente.key}
                    className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                    style={isExpanded ? EXPANDED_FRENTE_STYLE : undefined}
                    aria-labelledby={headingId}
                  >
                    <h2 id={headingId}>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        onClick={(event) => {
                          preserveScrollPosition(event.currentTarget);
                          toggleFrente(frente.key);
                        }}
                        className={`ticket-frente-toggle ${isExpanded ? 'ticket-frente-toggle--expanded' : ''} ${isChatOpen ? 'ticket-frente-toggle--chat' : ''} group w-full text-left transition-colors hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F69F19]`}
                      >
                        <span
                          className="ticket-frente-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset"
                          style={{
                            backgroundColor: `${frenteColor}14`,
                            color: frenteColor,
                            ['--tw-ring-color' as string]: `${frenteColor}33`,
                          }}
                        >
                          <FrenteIcon
                            icon={frente.icon}
                            frenteKey={frente.key}
                            label={frente.label}
                            className="h-5 w-5"
                          />
                        </span>

                        <span className="ticket-frente-title min-w-0">
                          <span
                            className={`block truncate font-bold leading-snug text-[#2C2D2F] ${isChatOpen ? 'text-base' : 'text-lg'}`}
                            title={frente.label}
                          >
                            {frente.label}
                          </span>
                          {unreadTicketCount > 0 ? (
                            <span className="density-meta mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#DE5532]/10 px-2 py-0.5 font-semibold text-[#B74426]">
                              <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DE5532] opacity-60 motion-reduce:animate-none" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#DE5532]" />
                              </span>
                              <span className="truncate">
                                {unreadTicketCount} {unreadTicketCount === 1 ? 'ticket com mensagem não lida' : 'tickets com mensagens não lidas'}
                              </span>
                            </span>
                          ) : (
                            <span className="density-meta mt-0.5 block text-slate-400">Sem mensagens não lidas</span>
                          )}
                        </span>

                        <span className="ticket-frente-affordance flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-slate-50 px-2 text-slate-500 transition-colors group-hover:bg-white group-hover:text-slate-700">
                          {isExpanded && <span className="hidden text-xs font-medium sm:inline">Recolher</span>}
                          <ChevronRight
                            className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${isExpanded ? 'rotate-90' : ''}`}
                            aria-hidden="true"
                          />
                        </span>

                        {!isExpanded && frente.ticketCount > 0 && (
                          <span className="ticket-frente-status block">
                            <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                              {STATUS_SEGMENTS.map((segment) => statusCounts[segment.key] > 0 && (
                                <span
                                  key={segment.key}
                                  className={segment.barClass}
                                  style={{ width: `${(statusCounts[segment.key] / frente.ticketCount) * 100}%` }}
                                />
                              ))}
                            </span>
                            <span className="density-meta mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500">
                              {STATUS_SEGMENTS.map((segment) => statusCounts[segment.key] > 0 && (
                                <span key={segment.key} className="inline-flex items-center gap-1.5">
                                  <span className={`h-1.5 w-1.5 rounded-full ${segment.barClass}`} aria-hidden="true" />
                                  <strong className="font-semibold text-slate-700">{statusCounts[segment.key]}</strong>{' '}
                                  {statusCounts[segment.key] === 1 ? segment.singular : segment.plural}
                                </span>
                              ))}
                            </span>
                          </span>
                        )}

                        {!isExpanded && !isChatOpen && topCategories.length > 0 && (
                          <span className="ticket-frente-cats flex min-w-0 flex-wrap gap-1.5">
                            {topCategories.map((category) => (
                              <span
                                key={category.key}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                              >
                                <span className="truncate">{category.label}</span>
                                <span className="font-semibold text-slate-800">{category.tickets.length}</span>
                              </span>
                            ))}
                            {hiddenCategoryCount > 0 && (
                              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-500">
                                +{hiddenCategoryCount}
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    </h2>

                    {isExpanded && (
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={headingId}
                        className={`ticket-frente-content border-t border-slate-200 bg-slate-50/70 ${isChatOpen ? 'p-2.5' : 'p-3 sm:p-4'}`}
                      >
                        <TicketCategoryGrid
                          categories={frente.categories}
                          expandedCategories={expandedCategories}
                          onToggleCategory={(key, button) => {
                            preserveScrollPosition(button);
                            toggleCategory(key);
                          }}
                          renderTicketCard={renderTicketCard}
                          isChatOpen={isChatOpen}
                          idPrefix={`${listId}-frente-${frenteIndex}`}
                        />
                      </div>
                    )}
                  </section>
                );
              })
            : categoryGroups.map((group, index) => renderCategoryGroup(group, String(index)))}
        </div>
      </div>
    </div>
  );
};

export default TicketList;
