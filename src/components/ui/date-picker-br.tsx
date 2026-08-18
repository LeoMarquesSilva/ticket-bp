import * as React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ptBR as dayPickerPtBR } from 'react-day-picker/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseDateBr } from '@/utils/desenvolvimentoContinuoForm';

const MONTH_LABELS = Array.from({ length: 12 }, (_, monthIndex) =>
  format(new Date(2020, monthIndex, 1), 'MMMM', { locale: ptBR }),
);

interface DatePickerBrProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Rótulo exibido no cabeçalho do calendário */
  label?: string;
  /** Primeiro ano disponível no seletor. Padrão: 100 anos atrás. */
  fromYear?: number;
  /** Último ano disponível no seletor. Padrão: 10 anos à frente. */
  toYear?: number;
  /** Impede escolher datas futuras (ex.: data de nascimento). */
  disableFuture?: boolean;
}

function clampDate(date: Date, min: Date, max: Date) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export function DatePickerBr({
  value,
  onChange,
  placeholder = 'Selecione a data',
  disabled = false,
  className,
  id,
  label = 'Data',
  fromYear,
  toYear,
  disableFuture = false,
}: DatePickerBrProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseDateBr(value);
  const today = React.useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const minYear = fromYear ?? currentYear - 100;
  const maxYear = disableFuture ? Math.min(toYear ?? currentYear, currentYear) : (toYear ?? currentYear + 10);
  const minMonth = React.useMemo(() => new Date(minYear, 0, 1), [minYear]);
  const maxMonth = React.useMemo(
    () => (disableFuture ? today : new Date(maxYear, 11, 1)),
    [disableFuture, maxYear, today],
  );
  const [month, setMonth] = React.useState<Date>(() => selected ?? today);

  React.useEffect(() => {
    if (selected) setMonth(selected);
  }, [value]);

  const years = React.useMemo(() => {
    const list: number[] = [];
    for (let year = maxYear; year >= minYear; year -= 1) list.push(year);
    return list;
  }, [minYear, maxYear]);

  const goToMonth = (next: Date) => {
    setMonth(clampDate(new Date(next.getFullYear(), next.getMonth(), 1), minMonth, maxMonth));
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    onChange(format(date, 'dd/MM/yyyy', { locale: ptBR }));
    setOpen(false);
  };

  const handleClear = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onChange('');
  };

  const handleToday = () => {
    onChange(format(today, 'dd/MM/yyyy', { locale: ptBR }));
    setMonth(today);
    setOpen(false);
  };

  const selectClassName = cn(
    'h-8 rounded-md border border-slate-200 bg-white px-2 text-sm font-medium capitalize text-[#2C2D2F]',
    'focus:border-[#F69F19] focus:outline-none focus:ring-2 focus:ring-[#F69F19]/25',
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm',
            'ring-offset-background transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19]/25 focus-visible:border-[#F69F19]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-slate-400',
            value && 'text-[#2C2D2F]',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 shrink-0 text-[#F69F19]" />
            {value || placeholder}
          </span>
          {value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="ml-2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Limpar data"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[200] w-auto border border-slate-200 p-0 shadow-lg"
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-[#F69F19]/5 to-[#DE5532]/5 px-4 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-sm font-semibold text-[#2C2D2F]">
            {selected
              ? format(selected, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
              : 'Nenhuma data selecionada'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 pt-3">
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            onClick={() => goToMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            disabled={month.getFullYear() === minYear && month.getMonth() === 0}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <select
            className={cn(selectClassName, 'min-w-0 flex-1')}
            value={month.getMonth()}
            onChange={(event) => goToMonth(new Date(month.getFullYear(), Number(event.target.value), 1))}
            aria-label="Mês"
          >
            {MONTH_LABELS.map((monthLabel, monthIndex) => (
              <option key={monthLabel} value={monthIndex}>
                {monthLabel}
              </option>
            ))}
          </select>
          <select
            className={cn(selectClassName, 'w-[5.75rem] shrink-0')}
            value={month.getFullYear()}
            onChange={(event) => goToMonth(new Date(Number(event.target.value), month.getMonth(), 1))}
            aria-label="Ano"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            onClick={() => goToMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            disabled={
              month.getFullYear() > maxMonth.getFullYear() ||
              (month.getFullYear() === maxMonth.getFullYear() && month.getMonth() >= maxMonth.getMonth())
            }
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <Calendar
          mode="single"
          locale={dayPickerPtBR}
          month={month}
          onMonthChange={goToMonth}
          selected={selected}
          onSelect={handleSelect}
          startMonth={minMonth}
          endMonth={maxMonth}
          disabled={disableFuture ? { after: today } : undefined}
          hideNavigation
          className="pt-1"
          classNames={{ month_caption: 'hidden' }}
        />

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-slate-600 hover:text-[#DE5532]"
            onClick={handleToday}
            disabled={today < minMonth || today > maxMonth}
          >
            Hoje
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-slate-500"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
