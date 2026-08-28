import { cn } from '@/lib/utils';

type AdaptiveTextBlock = {
  type: 'TextBlock';
  text?: string;
  weight?: string;
  size?: string;
  color?: string;
  isSubtle?: boolean;
  wrap?: boolean;
  spacing?: string;
};

type AdaptiveFactSet = {
  type: 'FactSet';
  facts?: Array<{ title?: string; value?: string }>;
};

type AdaptiveContainer = {
  type: 'Container';
  style?: string;
  bleed?: boolean;
  items?: AdaptiveElement[];
};

type AdaptiveColumn = {
  type: 'Column';
  width?: string;
  items?: AdaptiveElement[];
};

type AdaptiveColumnSet = {
  type: 'ColumnSet';
  spacing?: string;
  columns?: AdaptiveColumn[];
};

type AdaptiveElement = AdaptiveTextBlock | AdaptiveContainer | AdaptiveColumnSet | AdaptiveFactSet | { type: string };

type AdaptiveAction = {
  type?: string;
  title?: string;
  url?: string;
};

export type AdaptiveCardLike = {
  body?: AdaptiveElement[];
  actions?: AdaptiveAction[];
};

const TEXT_SIZE: Record<string, string> = {
  Small: 'text-[12px] leading-4',
  Default: 'text-[14px] leading-5',
  Medium: 'text-[16px] leading-6',
  Large: 'text-[20px] leading-7',
  ExtraLarge: 'text-[24px] leading-8',
};

const TEXT_COLOR: Record<string, string> = {
  Default: 'text-[#252423]',
  Dark: 'text-[#252423]',
  Light: 'text-white',
  Accent: 'text-[#5B5FC7]',
  Good: 'text-[#13A10E]',
  Warning: 'text-[#C19C00]',
  Attention: 'text-[#C4314B]',
};

const CONTAINER_STYLE: Record<string, string> = {
  emphasis: 'bg-[#F0F0F0]',
  accent: 'bg-[#5B5FC7]',
  good: 'bg-[#DFF6DD]',
  attention: 'bg-[#FDE7E9]',
  warning: 'bg-[#FFF4CE]',
};

function spacingClass(spacing?: string, isFirst?: boolean) {
  if (isFirst || spacing === 'None') return '';
  if (spacing === 'Small') return 'mt-1';
  if (spacing === 'Medium') return 'mt-3';
  if (spacing === 'Large') return 'mt-4';
  return 'mt-2';
}

function TextBlock({
  block,
  isFirst,
  inverted,
}: {
  block: AdaptiveTextBlock;
  isFirst?: boolean;
  inverted?: boolean;
}) {
  const colorClass = inverted
    ? (block.isSubtle ? 'text-white/75' : 'text-white')
    : block.isSubtle
      ? 'text-[#616161]'
      : (TEXT_COLOR[block.color ?? 'Default'] ?? TEXT_COLOR.Default);

  return (
    <p
      className={cn(
        'm-0',
        TEXT_SIZE[block.size ?? 'Default'] ?? TEXT_SIZE.Default,
        block.weight === 'Bolder' ? 'font-semibold' : 'font-normal',
        colorClass,
        block.wrap === false ? 'truncate' : 'whitespace-pre-wrap break-words',
        spacingClass(block.spacing, isFirst),
      )}
    >
      {block.text}
    </p>
  );
}

function FactSet({ facts }: { facts?: Array<{ title?: string; value?: string }> }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px] leading-5">
      {(facts ?? []).map((fact, index) => (
        <div key={`${fact.title}-${index}`} className="contents">
          <span className="font-semibold text-[#616161]">{fact.title}</span>
          <span className="break-words text-[#252423]">{fact.value}</span>
        </div>
      ))}
    </div>
  );
}

function CardElements({
  items,
  inverted = false,
}: {
  items?: AdaptiveElement[];
  inverted?: boolean;
}) {
  return (
    <>
      {(items ?? []).map((item, index) => {
        if (item.type === 'TextBlock') {
          return (
            <TextBlock
              key={`${item.type}-${index}`}
              block={item as AdaptiveTextBlock}
              isFirst={index === 0}
              inverted={inverted}
            />
          );
        }
        if (item.type === 'FactSet') {
          return <FactSet key={`${item.type}-${index}`} facts={(item as AdaptiveFactSet).facts} />;
        }
        if (item.type === 'ColumnSet') {
          const set = item as AdaptiveColumnSet;
          return (
            <div key={`${item.type}-${index}`} className={cn('flex items-start gap-2', spacingClass(set.spacing, index === 0))}>
              {(set.columns ?? []).map((column, columnIndex) => (
                <div
                  key={`${column.type}-${columnIndex}`}
                  className={column.width === 'auto' ? 'shrink-0' : 'min-w-0 flex-1'}
                >
                  <CardElements items={column.items} inverted={inverted} />
                </div>
              ))}
            </div>
          );
        }
        if (item.type === 'Container') {
          const container = item as AdaptiveContainer;
          const accent = container.style === 'accent';
          return (
            <div
              key={`${item.type}-${index}`}
              className={cn(
                container.bleed ? 'px-3 py-3' : 'rounded-md px-3 py-2.5',
                CONTAINER_STYLE[container.style ?? ''] ?? 'bg-transparent',
                !container.bleed && index > 0 ? 'mt-3' : '',
              )}
            >
              <CardElements items={container.items} inverted={accent} />
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

export function TeamsAdaptiveCardPreview({
  card,
  chatHtml,
}: {
  card: AdaptiveCardLike;
  chatHtml?: string;
}) {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-[#F5F5F5]">
      <div className="flex-1 space-y-3 px-4 py-5">
        <div className="flex items-end gap-2">
          <span className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5B5FC7] text-[11px] font-semibold text-white">R</span>
          <div className="min-w-0 max-w-[420px] flex-1">
            <p className="mb-1 text-[11px] font-medium text-[#616161]">Responsum</p>
            {chatHtml && (
              <div
                className="mb-2 rounded-[6px] bg-white px-3 py-2 text-[14px] leading-5 text-[#252423] shadow-[0_1px_2px_rgba(0,0,0,.08)] [&_p]:m-0 [&_p+p]:mt-1"
                dangerouslySetInnerHTML={{ __html: chatHtml }}
              />
            )}
            <article className="overflow-hidden rounded-md border border-[#E1E1E1] bg-white shadow-[0_1px_2px_rgba(0,0,0,.08)]">
              <CardElements items={card.body} />
              {(card.actions ?? []).length > 0 && (
                <div className="border-t border-[#E1E1E1] p-2">
                  {card.actions?.map((action, index) => (
                    <span
                      key={`${action.title}-${index}`}
                      className="flex items-center justify-center rounded-[4px] bg-[#5B5FC7] px-3 py-2 text-[14px] font-semibold text-white"
                    >
                      {action.title}
                    </span>
                  ))}
                </div>
              )}
            </article>
            <p className="mt-2 text-[11px] text-[#8A8A8A]">como o destinatário vê no Teams</p>
          </div>
        </div>
      </div>
    </div>
  );
}
