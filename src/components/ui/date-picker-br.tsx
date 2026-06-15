import * as React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { ptBR as dayPickerPtBR } from 'react-day-picker/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseDateBr } from '@/utils/desenvolvimentoContinuoForm';

interface DatePickerBrProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DatePickerBr({
  value,
  onChange,
  placeholder = 'Selecione a data',
  disabled = false,
  className,
  id,
}: DatePickerBrProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseDateBr(value);
  const [month, setMonth] = React.useState<Date>(() => selected ?? new Date());

  React.useEffect(() => {
    if (selected) setMonth(selected);
  }, [value]);

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
    const today = new Date();
    onChange(format(today, 'dd/MM/yyyy', { locale: ptBR }));
    setMonth(today);
    setOpen(false);
  };

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
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-[#F69F19]/5 to-[#DE5532]/5 px-4 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Data da realização</p>
          <p className="text-sm font-semibold text-[#2C2D2F]">
            {selected
              ? format(selected, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
              : 'Nenhuma data selecionada'}
          </p>
        </div>

        <Calendar
          mode="single"
          locale={dayPickerPtBR}
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          onSelect={handleSelect}
          initialFocus
        />

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-slate-600 hover:text-[#DE5532]"
            onClick={handleToday}
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
