import React from 'react';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Inbox,
  SearchX,
} from 'lucide-react';
import { Ticket } from '@/types';
import { FrenteIcon } from '@/components/FrenteIcon';
import TicketCategoryGrid from '@/components/TicketCategoryGrid';
import type { CategoriesConfigMap } from '@/utils/ticketFilterUtils';
import {
  groupTicketsByCategory,
  groupTicketsByFrente,
  toggleFrenteCategoryExpansion,
  type TicketCategoryGroup,
  type TicketFrenteDefinition,
} from '@/utils/ticketCategoryGroups';

const FRENTE_GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
};

const EXPANDED_FRENTE_STYLE: React.CSSProperties = { gridColumn: '1 / -1' };

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
  isChatOpen = false
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
  const categoryGroups = React.useMemo(
    () => groupTicketsByCategory(filteredTickets, categoriesConfig),
    [categoriesConfig, filteredTickets],
  );
  const frenteGroups = React.useMemo(
    () => groupTicketsByFrente(filteredTickets, categoriesConfig, frentes),
    [categoriesConfig, filteredTickets, frentes],
  );
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
        <div className="mb-2 flex min-h-10 items-center justify-between gap-3 px-1">
          <p className="density-meta text-slate-500" aria-live="polite">
            {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'} em{' '}
            {groupByFrente ? (
              <>
                {frenteGroups.length} {frenteGroups.length === 1 ? 'frente de atuação' : 'frentes de atuação'} e{' '}
                {categoryGroups.length} {categoryGroups.length === 1 ? 'categoria' : 'categorias'}
              </>
            ) : (
              <>
                {categoryGroups.length} {categoryGroups.length === 1 ? 'categoria' : 'categorias'}
              </>
            )}
          </p>
          <button
            type="button"
            onClick={toggleAllCategories}
            className="density-meta min-h-10 shrink-0 rounded-lg px-2.5 font-semibold text-[#B74426] transition-colors hover:bg-[#DE5532]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19] focus-visible:ring-offset-2"
          >
            {allVisibleHierarchyExpanded ? 'Recolher todas' : 'Expandir todas'}
          </button>
        </div>

        <div
          className={groupByFrente
            ? 'grid gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500'
            : 'space-y-2.5 animate-in fade-in slide-in-from-bottom-4 duration-500'}
          style={groupByFrente ? FRENTE_GRID_STYLE : undefined}
        >
          {groupByFrente
            ? frenteGroups.map((frente, frenteIndex) => {
                const isExpanded = expandedFrentes.has(frente.key);
                const headingId = `${listId}-frente-heading-${frenteIndex}`;
                const panelId = `${listId}-frente-panel-${frenteIndex}`;
                const ticketCountLabel = `${frente.ticketCount} ${frente.ticketCount === 1 ? 'ticket' : 'tickets'}`;
                const categoryKeys = frente.categories.map((category) => category.key);
                const allCategoriesExpanded = categoryKeys.every((key) => expandedCategories.has(key));

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
                          <span className="ticket-frente-icon relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/80">
                            <FrenteIcon
                              icon={frente.icon}
                              frenteKey={frente.key}
                              label={frente.label}
                              className="h-5 w-5"
                            />
                            <span
                              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white"
                              style={{ backgroundColor: frente.color || '#DE5532' }}
                              aria-hidden="true"
                            />
                          </span>
                          <span className="ticket-frente-affordance flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-slate-50 px-2 text-slate-500 transition-colors group-hover:bg-white group-hover:text-slate-700">
                            {isExpanded && <span className="hidden text-xs font-medium sm:inline">Recolher</span>}
                            <ChevronRight
                              className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${isExpanded ? 'rotate-90' : ''}`}
                              aria-hidden="true"
                            />
                          </span>

                        <span className="ticket-frente-title min-w-0">
                          <span className="density-meta block font-semibold text-slate-500">
                            Frente de atuação
                          </span>
                          <span className="mt-1 block line-clamp-2 text-[17px] font-bold leading-snug text-[#2C2D2F]">
                            {frente.label}
                          </span>
                        </span>

                        <span className="ticket-frente-counts flex flex-wrap gap-2">
                          <span
                            className="density-badge inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 font-medium text-slate-600"
                            aria-label={`${frente.categories.length} ${frente.categories.length === 1 ? 'categoria' : 'categorias'}`}
                          >
                            <strong className="text-sm font-bold text-slate-800">{frente.categories.length}</strong>
                            {frente.categories.length === 1 ? 'categoria' : 'categorias'}
                          </span>
                          <span
                            className="density-badge inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#DE5532]/15 bg-[#DE5532]/10 px-3 font-medium text-[#9F3D24]"
                            aria-label={ticketCountLabel}
                          >
                            <strong className="text-sm font-bold">{frente.ticketCount}</strong>
                            {frente.ticketCount === 1 ? 'ticket' : 'tickets'}
                          </span>
                        </span>
                      </button>
                    </h2>

                    {isExpanded && (
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={headingId}
                        className="ticket-frente-content border-t border-slate-200 bg-slate-50/70 p-3 sm:p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <p className="text-sm font-medium text-slate-600">Categorias desta frente</p>
                          <button
                            type="button"
                            aria-label={`${allCategoriesExpanded ? 'Recolher' : 'Expandir'} categorias de ${frente.label}`}
                            onClick={(event) => {
                              preserveScrollPosition(event.currentTarget);
                              onExpandedCategoryKeysChange(toggleFrenteCategoryExpansion(
                                expandedCategoryKeys, categoryKeys,
                              ));
                            }}
                            className="min-h-10 rounded-lg px-2.5 text-sm font-semibold text-[#9F3D24] transition-colors hover:bg-[#DE5532]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19] focus-visible:ring-offset-2"
                          >
                            {allCategoriesExpanded ? 'Recolher categorias' : 'Expandir categorias'}
                          </button>
                        </div>
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
