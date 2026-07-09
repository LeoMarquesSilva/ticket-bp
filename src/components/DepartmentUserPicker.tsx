import { useMemo, useState } from 'react';
import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export interface DepartmentUserPickerUser {
  id: string;
  name: string;
  email: string;
  department?: string;
  avatarUrl?: string;
}

interface DepartmentUserPickerProps {
  value?: string;
  onChange: (userId: string) => void;
  users: DepartmentUserPickerUser[];
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function normalizeDepartment(department?: string): string {
  const trimmed = String(department ?? '').trim();
  return trimmed || 'Sem área';
}

export default function DepartmentUserPicker({
  value,
  onChange,
  users,
  loading = false,
  disabled = false,
  placeholder = 'Selecione o jurídico que vai atender',
  className,
}: DepartmentUserPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState('all');

  const selectedUser = useMemo(
    () => users.find((user) => user.id === value),
    [users, value],
  );

  const departments = useMemo(() => {
    const names = new Set(users.map((user) => normalizeDepartment(user.department)));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (selectedDept === 'all') return true;
      return normalizeDepartment(user.department) === selectedDept;
    });
  }, [users, selectedDept]);

  const groupedUsers = useMemo(() => {
    const groups = new Map<string, DepartmentUserPickerUser[]>();

    filteredUsers.forEach((user) => {
      const dept = normalizeDepartment(user.department);
      const list = groups.get(dept) ?? [];
      list.push(user);
      groups.set(dept, list);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([department, departmentUsers]) => ({
        department,
        users: departmentUsers.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      }));
  }, [filteredUsers]);

  const handleSelect = (userId: string) => {
    onChange(userId);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || loading}
            className={cn(
              'h-10 w-full justify-between px-3 font-normal border-slate-300 focus:ring-[#F69F19]/20',
              !selectedUser && 'text-muted-foreground',
              className,
            )}
          >
            <span className="flex min-w-0 flex-1 items-center text-left">
              {loading ? (
                <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando usuários...
                </span>
              ) : selectedUser ? (
                <UserMention
                  name={selectedUser.name}
                  avatarUrl={selectedUser.avatarUrl}
                  subtitle={normalizeDepartment(selectedUser.department)}
                  size="sm"
                  className="min-w-0"
                />
              ) : (
                <span className="truncate text-sm">{placeholder}</span>
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
          <div className="border-b border-slate-100 p-3 space-y-2">
            <Label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <Building2 className="h-3.5 w-3.5 text-slate-500" />
              Área
            </Label>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas as áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as áreas</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Command
            filter={(itemValue, search) => {
              if (!search) return 1;
              return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Buscar por nome, e-mail ou área..." />
            <CommandList className="max-h-72">
              <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
              {groupedUsers.map(({ department, users: departmentUsers }) => (
                <CommandGroup key={department} heading={department}>
                  {departmentUsers.map((user) => {
                    const area = normalizeDepartment(user.department);
                    const searchValue = `${user.name} ${user.email} ${area}`;
                    return (
                      <CommandItem
                        key={user.id}
                        value={searchValue}
                        onSelect={() => handleSelect(user.id)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4 shrink-0',
                            value === user.id ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <UserMention
                          name={user.name}
                          avatarUrl={user.avatarUrl}
                          subtitle={area}
                          size="sm"
                          className="min-w-0 flex-1"
                        />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
