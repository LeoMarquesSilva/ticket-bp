import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, Building2, RefreshCw } from 'lucide-react';
import { UserService } from '@/services/userService';
import { DepartmentService } from '@/services/departmentService';
import { User } from '@/types';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  lawyer: 'Advogado',
  advogado: 'Advogado',
  support: 'Suporte',
  admin: 'Admin',
};

function getRoleLabel(role: string): string {
  const r = String(role ?? '').toLowerCase();
  return (ROLE_LABELS[r] ?? role) || '—';
}

interface TransferTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  currentAssignee?: string;
  onTransfer: (supportId: string, supportName: string) => Promise<void>;
}

const TransferTicketModal: React.FC<TransferTicketModalProps> = ({
  open,
  onOpenChange,
  ticketId,
  currentAssignee,
  onTransfer,
}) => {
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [supportUsers, setSupportUsers] = useState<User[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoadingUsers(true);
      try {
        const [usersRes, deptsRes] = await Promise.allSettled([
          UserService.getSupportUsers(),
          DepartmentService.getActiveDepartments(),
        ]);
        const users = usersRes.status === 'fulfilled' ? usersRes.value : [];
        const depts = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
        if (usersRes.status === 'rejected') {
          toast.error('Erro ao carregar usuários');
        }
        const filtered = users.filter((u) => u.id !== currentAssignee);
        setSupportUsers(filtered);
        setDepartments(depts);
        setSelectedDept('all');
        setSelectedUser('');
      } catch (e) {
        console.error(e);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoadingUsers(false);
      }
    };
    load();
  }, [open, currentAssignee]);

  const filteredUsers = selectedDept === 'all'
    ? supportUsers
    : supportUsers.filter((u) => String(u.department ?? '').trim() === selectedDept);

  const handleTransfer = async () => {
    if (!selectedUser) {
      toast.error('Selecione um usuário');
      return;
    }
    const u = supportUsers.find((x) => x.id === selectedUser);
    if (!u) return;
    setLoading(true);
    try {
      await onTransfer(selectedUser, u.name);
      onOpenChange(false);
      toast.success(`Ticket transferido para ${u.name}`);
    } catch (e) {
      toast.error('Erro ao transferir ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#F69F19]" />
            Transferir Ticket
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-slate-500" />
              Departamento
            </Label>
            <Select value={selectedDept} onValueChange={(v) => { setSelectedDept(v); setSelectedUser(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os departamentos</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Usuários</Label>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-[#F69F19]" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                {selectedDept === 'all'
                  ? 'Nenhum usuário disponível para transferência.'
                  : 'Nenhum usuário neste departamento.'}
              </p>
            ) : (
              <ScrollArea className="h-[220px] rounded-md border p-1">
                <div className="space-y-1">
                  {filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUser(selectedUser === u.id ? '' : u.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                        selectedUser === u.id
                          ? 'bg-[#F69F19]/15 border border-[#F69F19]/40'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-[#F69F19]/20 text-[#2C2D2F]">
                          {u.name?.charAt(0).toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        <p className="text-xs text-slate-500">{getRoleLabel(u.role)}</p>
                      </div>
                      {u.isOnline && (
                        <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" title="Online" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedUser || loading}
            className="bg-[#F69F19] hover:bg-[#e08e12] text-white"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Transferir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransferTicketModal;
