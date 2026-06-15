import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import UserMention from '@/components/UserMention';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface Props {
  value?: string;
  onChange: (userId: string | undefined) => void;
  users: User[];
  getRoleLabel: (role: string) => string;
  noneLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Quando false, oculta a opção de limpar seleção (campos obrigatórios). */
  allowNone?: boolean;
}

export default function UserAssigneePicker({
  value,
  onChange,
  users,
  getRoleLabel,
  noneLabel = 'Nenhum (Atribuição Manual)',
  placeholder = 'Selecione um usuário',
  disabled = false,
  className,
  allowNone = true,
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === value),
    [users, value]
  );

  const handleSelect = (userId: string | undefined) => {
    onChange(userId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-10 w-full justify-between px-3 font-normal',
            !selectedUser && 'text-muted-foreground',
            className
          )}
        >
          <span className="flex min-w-0 flex-1 items-center text-left">
            {selectedUser ? (
              <UserMention
                name={selectedUser.name}
                avatarUrl={selectedUser.avatarUrl}
                subtitle={getRoleLabel(selectedUser.role)}
                size="sm"
                className="min-w-0"
              />
            ) : (
              <span className="truncate text-sm">{noneLabel}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[200] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command
          filter={(itemValue, search) => {
            if (!search) return 1;
            return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por nome, e-mail ou função..." />
          <CommandList>
            <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value={`${noneLabel} manual atribuicao nenhum`}
                  onSelect={() => handleSelect(undefined)}
                >
                  <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                  <span className="text-sm">{noneLabel}</span>
                </CommandItem>
              )}
              {users.map((user) => {
                const roleLabel = getRoleLabel(user.role);
                const searchValue = `${user.name} ${user.email} ${roleLabel} ${user.role}`;
                return (
                  <CommandItem
                    key={user.id}
                    value={searchValue}
                    onSelect={() => handleSelect(user.id)}
                  >
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', value === user.id ? 'opacity-100' : 'opacity-0')} />
                    <UserMention
                      name={user.name}
                      avatarUrl={user.avatarUrl}
                      subtitle={roleLabel}
                      size="sm"
                      className="min-w-0 flex-1"
                    />
                    {user.isOnline && (
                      <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-green-500" title="Online" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
