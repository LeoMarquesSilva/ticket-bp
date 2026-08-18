import { useMemo, useState, type MouseEvent } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

interface BaseProps {
  users: User[];
  getRoleLabel: (role: string) => string;
  noneLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Quando false, oculta a opção de limpar seleção (campos obrigatórios). */
  allowNone?: boolean;
}

interface SingleProps extends BaseProps {
  multiple?: false;
  value?: string;
  onChange: (userId: string | undefined) => void;
}

interface MultiProps extends BaseProps {
  multiple: true;
  value?: string[];
  onChange: (userIds: string[]) => void;
}

type Props = SingleProps | MultiProps;

export default function UserAssigneePicker(props: Props) {
  const {
    users,
    getRoleLabel,
    noneLabel = 'Nenhum (Atribuição Manual)',
    disabled = false,
    className,
    allowNone = true,
  } = props;

  const multiple = props.multiple === true;
  const [open, setOpen] = useState(false);

  const selectedIds = useMemo(() => {
    if (multiple) return props.value ?? [];
    return props.value ? [props.value] : [];
  }, [multiple, props.value]);

  const selectedUsers = useMemo(
    () => users.filter((u) => selectedIds.includes(u.id)),
    [users, selectedIds],
  );

  const handleSelectSingle = (userId: string | undefined) => {
    if (multiple) return;
    props.onChange(userId);
    setOpen(false);
  };

  const handleToggleMulti = (userId: string) => {
    if (!multiple) return;
    const current = props.value ?? [];
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    props.onChange(next);
  };

  const handleRemoveMulti = (userId: string, event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!multiple) return;
    props.onChange((props.value ?? []).filter((id) => id !== userId));
  };

  const triggerLabel = multiple
    ? selectedUsers.length === 0
      ? (props.noneLabel ?? 'Selecione os facilitadores')
      : selectedUsers.length === 1
        ? selectedUsers[0].name
        : `${selectedUsers.length} selecionados`
    : noneLabel;

  return (
    <div className="space-y-2">
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
              selectedUsers.length === 0 && 'text-muted-foreground',
              className,
            )}
          >
            <span className="flex min-w-0 flex-1 items-center text-left">
              {!multiple && selectedUsers[0] ? (
                <UserMention
                  name={selectedUsers[0].name}
                  userId={selectedUsers[0].id}
                  avatarUrl={selectedUsers[0].avatarUrl}
                  subtitle={getRoleLabel(selectedUsers[0].role)}
                  size="sm"
                  className="min-w-0"
                />
              ) : (
                <span className="truncate text-sm">{triggerLabel}</span>
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
                {allowNone && !multiple && (
                  <CommandItem
                    value={`${noneLabel} manual atribuicao nenhum`}
                    onSelect={() => handleSelectSingle(undefined)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedIds.length === 0 ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="text-sm">{noneLabel}</span>
                  </CommandItem>
                )}
                {users.map((user) => {
                  const roleLabel = getRoleLabel(user.role);
                  const searchValue = `${user.name} ${user.email} ${roleLabel} ${user.role}`;
                  const isSelected = selectedIds.includes(user.id);
                  return (
                    <CommandItem
                      key={user.id}
                      value={searchValue}
                      onSelect={() => {
                        if (multiple) {
                          handleToggleMulti(user.id);
                        } else {
                          handleSelectSingle(user.id);
                        }
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <UserMention
                        name={user.name}
                        userId={user.id}
                        avatarUrl={user.avatarUrl}
                        subtitle={roleLabel}
                        size="sm"
                        className="min-w-0 flex-1"
                      />
                      {user.isOnline && (
                        <span
                          className="ml-auto h-2 w-2 shrink-0 rounded-full bg-green-500"
                          title="Online"
                        />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {multiple && selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((user) => (
            <Badge
              key={user.id}
              variant="secondary"
              className="gap-1 pr-1 font-normal bg-white border border-[#8B5CF6]/20 text-[#2C2D2F]"
            >
              <span className="truncate max-w-[160px]">{user.name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemoveMulti(user.id, e)}
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-[#BD2D29]"
                  aria-label={`Remover ${user.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
