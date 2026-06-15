import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayButton, DayPicker, type DayButtonProps } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function CalendarDayButton({ day, modifiers, className, ...props }: DayButtonProps) {
  return (
    <button
      {...props}
      type="button"
      data-day={day.date.toLocaleDateString('pt-BR')}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-normal transition-colors',
        'hover:bg-[#F69F19]/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19]/35',
        modifiers.selected &&
          'bg-[#F69F19] text-white font-semibold shadow-sm hover:bg-[#DE5532] hover:text-white',
        modifiers.today &&
          !modifiers.selected &&
          'bg-[#F69F19]/10 font-semibold text-[#DE5532] ring-1 ring-inset ring-[#F69F19]/30',
        modifiers.outside && !modifiers.selected && 'text-slate-300 hover:text-slate-400',
        modifiers.disabled && 'pointer-events-none opacity-35',
        className,
      )}
    />
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month: 'relative flex w-[280px] flex-col gap-3',
        month_caption: 'relative flex h-9 items-center justify-center',
        caption_label: 'text-sm font-semibold capitalize text-[#2C2D2F]',
        nav: 'absolute inset-x-0 top-0 flex h-9 items-center justify-between px-0.5',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-8 w-8 border-slate-200 bg-white p-0 text-slate-600 shadow-none hover:bg-slate-50',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-8 w-8 border-slate-200 bg-white p-0 text-slate-600 shadow-none hover:bg-slate-50',
        ),
        month_grid: 'mt-1 w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'flex h-8 w-9 items-center justify-center text-[0.68rem] font-semibold uppercase tracking-wide text-slate-400',
        week: 'mt-0.5 flex w-full',
        day: 'flex h-9 w-9 items-center justify-center p-0 text-center text-sm',
        day_button: 'h-9 w-9 p-0',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
          return <Icon className={cn('h-4 w-4', chevronClassName)} {...chevronProps} />;
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

Calendar.displayName = 'Calendar';

export { Calendar, CalendarDayButton };
