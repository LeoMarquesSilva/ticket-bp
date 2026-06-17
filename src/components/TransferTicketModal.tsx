import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import UserAvatar from '@/components/UserAvatar';
import { UserPlus, Building2, RefreshCw, Search, Tag, AlertCircle } from 'lucide-react';
import { UserService } from '@/services/userService';
import { DepartmentService } from '@/services/departmentService';
import { CategoryService } from '@/services/categoryService';
import { TicketService } from '@/services/ticketService';
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

type CategoriesConfig = Record<
  string,
  { label: string; tagId?: string; subcategories: { value: string; label: string; slaHours: number }[] }
>;

interface TransferTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  currentAssignee?: string;
  currentCategory?: string;
  currentSubcategory?: string;
  supportUsers?: User[];
  onTransfer: (supportId: string, supportName: string) => Promise<void>;
}

const TransferTicketModal: React.FC<TransferTicketModalProps> = ({
  open,
  onOpenChange,
  ticketId,
  currentAssignee,
  currentCategory = '',
  currentSubcategory = '',
  supportUsers: supportUsersProp = [],
  onTransfer,
}) => {
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [supportUsers, setSupportUsers] = useState<User[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Frente / Categoria / Subcategoria
  const [categoriesConfig, setCategoriesConfig] = useState<CategoriesConfig>({});
  const [frentes, setFrentes] = useState<{ id: string; label: string; color: string }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [frenteId, setFrenteId] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [subcategory, setSubcategory] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoadingUsers(true);
      setLoadingCategories(true);
      try {
        const [usersRes, deptsRes, catsRes, tagsRes] = await Promise.allSettled([
          supportUsersProp.length > 0
            ? Promise.resolve(supportUsersProp)
            : UserService.getSupportUsers(),
          DepartmentService.getActiveDepartments(),
          CategoryService.getCategoriesConfig(),
          CategoryService.getAllTags(false),
        ]);
        const users = usersRes.status === 'fulfilled' ? usersRes.value : [];
        const depts = deptsRes.status === 'fulfilled' ? deptsRes.value : [];
        const cats = catsRes.status === 'fulfilled' ? catsRes.value : {};
        const tags = tagsRes.status === 'fulfilled' ? tagsRes.value : [];
        if (usersRes.status === 'rejected') {
          toast.error('Erro ao carregar usuários');
        }
        const filtered = users.filter((u) => u.id !== currentAssignee);
        setSupportUsers(filtered);
        setDepartments(depts);
        setCategoriesConfig(cats);
        setFrentes(tags.map((t) => ({ id: t.id, label: t.label, color: t.color })));
        setSelectedDept('all');
        setSelectedUser('');
        setSearchTerm('');
        // Pré-preencher com a frente/categoria/subcategoria atual do ticket
        const currentTagId = cats[currentCategory]?.tagId;
        setFrenteId(currentCategory ? (currentTagId || 'sem-frente') : '');
        setCategory(currentCategory || '');
        setSubcategory(currentSubcategory || '');
      } catch (e) {
        console.error(e);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoadingUsers(false);
        setLoadingCategories(false);
      }
    };
    load();
  }, [open, currentAssignee, supportUsersProp, currentCategory, currentSubcategory]);

  // Categorias filtradas pela frente selecionada
  const categoriesByFrente = frenteId === ''
    ? Object.entries(categoriesConfig)
    : frenteId === 'sem-frente'
      ? Object.entries(categoriesConfig).filter(([, c]) => !c.tagId)
      : Object.entries(categoriesConfig).filter(([, c]) => c.tagId === frenteId);

  const subcategories = category ? categoriesConfig[category]?.subcategories ?? [] : [];

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return supportUsers.filter((u) => {
      const matchesDept =
        selectedDept === 'all' || String(u.department ?? '').trim() === selectedDept;
      const matchesSearch =
        term === '' ||
        u.name.toLowerCase().includes(term) ||
        getRoleLabel(u.role).toLowerCase().includes(term) ||
        String(u.department ?? '').toLowerCase().includes(term);
      return matchesDept && matchesSearch;
    });
  }, [supportUsers, selectedDept, searchTerm]);

  const categoryChanged =
    category !== (currentCategory || '') || subcategory !== (currentSubcategory || '');

  const canTransfer = !!selectedUser && !!category && !!subcategory && !loading;

  const handleTransfer = async () => {
    if (!category || !subcategory) {
      toast.error('Selecione a categoria e a subcategoria antes de transferir');
      return;
    }
    if (!selectedUser) {
      toast.error('Selecione um usuário');
      return;
    }
    const u = supportUsers.find((x) => x.id === selectedUser);
    if (!u) return;
    setLoading(true);
    try {
      // Atualizar categoria/subcategoria antes de transferir (garante notificação correta)
      if (categoryChanged) {
        await TicketService.updateTicket(ticketId, { category, subcategory });
      }
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
          {/* Passo 1: Categoria / Subcategoria */}
          <div className="rounded-lg border border-[#F69F19]/30 bg-[#F69F19]/5 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-[#F69F19] mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600">
                Confirme ou ajuste a <strong>frente</strong>, <strong>categoria</strong> e{' '}
                <strong>subcategoria</strong> do ticket antes de transferir. Elas definem as
                notificações automáticas (ex: aviso no WhatsApp).
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Tag className="h-4 w-4 text-slate-500" />
                Frente de Atuação
              </Label>
              <Select
                value={frenteId}
                onValueChange={(v) => {
                  setFrenteId(v);
                  setCategory('');
                  setSubcategory('');
                }}
                disabled={loadingCategories}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingCategories ? 'Carregando...' : 'Selecione a frente de atuação'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem-frente">Sem Frente de Atuação</SelectItem>
                  {frentes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                        {f.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Categoria</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  setSubcategory('');
                }}
                disabled={!frenteId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!frenteId ? 'Selecione a frente primeiro' : 'Selecione a categoria'} />
                </SelectTrigger>
                <SelectContent>
                  {categoriesByFrente.map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Subcategoria</Label>
              <Select value={subcategory} onValueChange={setSubcategory} disabled={!category}>
                <SelectTrigger>
                  <SelectValue placeholder={!category ? 'Selecione a categoria primeiro' : 'Selecione a subcategoria'} />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Passo 2: Filtro por departamento + busca */}
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome, perfil ou departamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-[#F69F19]" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                {searchTerm.trim()
                  ? 'Nenhum usuário encontrado para a busca.'
                  : selectedDept === 'all'
                    ? 'Nenhum usuário disponível para transferência.'
                    : 'Nenhum usuário neste departamento.'}
              </p>
            ) : (
              <ScrollArea className="h-[200px] rounded-md border p-1">
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
                      <UserAvatar
                        name={u.name}
                        avatarUrl={u.avatarUrl}
                        size="md"
                        fallbackClassName="text-xs bg-[#F69F19]/20 text-[#2C2D2F]"
                      />
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
            disabled={!canTransfer}
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
