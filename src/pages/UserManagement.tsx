import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserService, CreateUserData } from '@/services/userService';
import { User, UserRole, Department } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, RefreshCw, Pencil, UserX, UserCheck, Filter, AlertTriangle, Search, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


export default function UserManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(true); // Mostrar inativos por padrão na admin
  const [toggleLoading, setToggleLoading] = useState<string | null>(null); // ID do usuário sendo alterado
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    userId: string;
    userName: string;
    currentStatus: boolean;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    userId: string;
    userName: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // all, active, inactive
  const [onlineStatusFilter, setOnlineStatusFilter] = useState<string>('all'); // all, online, offline
    const [newUser, setNewUser] = useState<CreateUserData>({
      name: '',
      email: '',
      password: '',
      role: 'user',
      department: Department.GERAL, // Usando o enum em vez da string literal
    });

  const resetForm = () => {
  setNewUser({
    name: '',
    email: '',
    password: '',
    role: 'user',
    department: Department.GERAL, // Usando o enum em vez da string literal
  });
  setCreateDialogOpen(false);
};
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Redirecionar se não for admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: 'Acesso negado',
        description: 'Você não tem permissão para acessar esta página.',
        variant: 'destructive',
      });
      navigate('/tickets');
    }
  }, [user, navigate]);

  // Carregar usuários
  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await UserService.getAllUsers(true); // Sempre buscar todos (incluindo inativos)
      setUsers(data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a lista de usuários.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtrar usuários baseado nos filtros selecionados
  const getFilteredUsers = () => {
    let filtered = [...users];

    // Filtro de busca (nome ou email)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term)
      );
    }

    // Filtro de departamento
    if (departmentFilter !== 'all') {
      filtered = filtered.filter((user) => user.department === departmentFilter);
    }

    // Filtro de função (role)
    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    // Filtro de status (ativo/inativo)
    if (statusFilter === 'active') {
      filtered = filtered.filter((user) => user.isActive !== false);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((user) => user.isActive === false);
    }

    // Filtro de status online
    if (onlineStatusFilter === 'online') {
      filtered = filtered.filter((user) => user.isOnline === true);
    } else if (onlineStatusFilter === 'offline') {
      filtered = filtered.filter((user) => user.isOnline !== true);
    }

    // Filtro de mostrar/ocultar inativos (compatibilidade)
    if (!showInactive) {
      filtered = filtered.filter((user) => user.isActive !== false);
    }

    return filtered;
  };

  // Limpar todos os filtros
  const clearFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('all');
    setRoleFilter('all');
    setStatusFilter('all');
    setOnlineStatusFilter('all');
  };

  // Verificar se há filtros ativos
  const hasActiveFilters = searchTerm || departmentFilter !== 'all' || roleFilter !== 'all' || 
                          statusFilter !== 'all' || onlineStatusFilter !== 'all';

  const filteredUsers = getFilteredUsers();


  useEffect(() => {
    if (user?.role === 'admin') {
      loadUsers();
    }
  }, [user]);

// Criar novo usuário
const handleCreateUser = async () => {
  try {
    setCreateLoading(true);
    
    // Validações básicas
    if (!newUser.name || !newUser.email || !newUser.password || !newUser.role || !newUser.department) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios, incluindo o departamento.',
        variant: 'destructive',
      });
      setCreateLoading(false);
      return;
    }

    // Validar email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) {
      toast({
        title: 'Email inválido',
        description: 'Por favor, insira um endereço de email válido.',
        variant: 'destructive',
      });
      setCreateLoading(false);
      return;
    }

    // Validar senha (mínimo 6 caracteres)
    if (newUser.password.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      setCreateLoading(false);
      return;
    }

    // Verificar se o usuário já existe
    try {
      const existingUsers = await UserService.getUserByEmail(newUser.email);
      if (existingUsers && existingUsers.length > 0) {
        toast({
          title: 'Email já cadastrado',
          description: 'Este endereço de email já está sendo usado por outro usuário.',
          variant: 'destructive',
        });
        setCreateLoading(false);
        return;
      }
    } catch (error) {
      console.log('Erro ao verificar email existente:', error);
      // Continuar mesmo com erro na verificação
    }

    // Criar usuário
    await UserService.createUserAdmin(newUser);
    
    toast({
      title: 'Usuário criado',
      description: `${newUser.name} foi adicionado com sucesso.`,
    });
    
    // Limpar formulário e fechar diálogo
    setNewUser({
      name: '',
      email: '',
      password: '',
      role: 'user',
      department: 'Geral', // Valor padrão
    });
    setCreateDialogOpen(false);
    
    // Recarregar lista de usuários
    loadUsers();
    
  } catch (error: any) {
    console.error('Erro ao criar usuário:', error);
    toast({
      title: 'Erro ao criar usuário',
      description: error.message || 'Ocorreu um erro ao criar o usuário.',
      variant: 'destructive',
    });
  } finally {
    setCreateLoading(false);
  }
};

  // Iniciar edição de usuário
  const handleEditStart = (userItem: User) => {
    setEditingUser(userItem);
    setEditDialogOpen(true);
  };

  // Salvar edição de usuário
  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      setEditLoading(true);
      
      // Validações básicas
      if (!editingUser.name || !editingUser.role || !editingUser.department) {
        toast({
          title: 'Campos obrigatórios',
          description: 'Preencha todos os campos obrigatórios.',
          variant: 'destructive',
        });
        setEditLoading(false);
        return;
      }

      await UserService.updateUser(editingUser.id, {
        name: editingUser.name,
        role: editingUser.role,
        department: editingUser.department,
      });

      toast({
        title: 'Usuário atualizado',
        description: `${editingUser.name} foi atualizado com sucesso.`,
      });
      
      setEditDialogOpen(false);
      setEditingUser(null);
      
      // Recarregar lista de usuários
      loadUsers();
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      toast({
        title: 'Erro ao atualizar usuário',
        description: error.message || 'Ocorreu um erro ao atualizar o usuário.',
        variant: 'destructive',
      });
    } finally {
      setEditLoading(false);
    }
  };

// Abrir modal de confirmação para ativar/desativar
const handleToggleUserStatusClick = (userId: string, userName: string, currentStatus: boolean) => {
  setPendingAction({ userId, userName, currentStatus });
  setConfirmDialogOpen(true);
};

// Confirmar e executar ativação/desativação
const handleConfirmToggleStatus = async () => {
  if (!pendingAction) return;

  const { userId, userName, currentStatus } = pendingAction;
  const newStatus = !currentStatus;

  try {
    setToggleLoading(userId);
    setConfirmDialogOpen(false);
    await UserService.toggleUserActiveStatus(userId, newStatus);
    toast({
      title: 'Status alterado',
      description: `${userName} foi ${newStatus ? 'ativado' : 'desativado'} com sucesso.`,
    });
    loadUsers();
  } catch (error: any) {
    console.error('Erro ao alterar status do usuário:', error);
    toast({
      title: 'Erro ao alterar status',
      description: error.message || 'Não foi possível alterar o status do usuário.',
      variant: 'destructive',
    });
  } finally {
    setToggleLoading(null);
    setPendingAction(null);
  }
};

// Abrir modal de confirmação para excluir usuário
const handleDeleteUser = (userId: string, userName: string) => {
  setPendingDelete({ userId, userName });
  setDeleteDialogOpen(true);
};

// Confirmar e executar exclusão de usuário
const handleConfirmDelete = async () => {
  if (!pendingDelete) return;

  const { userId, userName } = pendingDelete;

  try {
    setDeleteLoading(true);
    setDeleteDialogOpen(false);
    await UserService.deleteUser(userId);
    toast({
      title: 'Usuário processado',
      description: `${userName} foi removido ou anonimizado com sucesso.`,
    });
    loadUsers();
  } catch (error: any) {
    console.error('Erro ao excluir usuário:', error);
    toast({
      title: 'Erro ao processar usuário',
      description: error.message || 'Não foi possível excluir ou anonimizar o usuário.',
      variant: 'destructive',
    });
  } finally {
    setDeleteLoading(false);
    setPendingDelete(null);
  }
};

  // Traduzir role para português
  const translateRole = (role: string) => {
    const translations: Record<string, string> = {
      user: 'Usuário',
      support: 'Suporte',
      admin: 'Administrador',
      lawyer: 'Advogado',
    };
    return translations[role] || role;
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-8 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Premium - Mesmo estilo do Dashboard */}
      <div className="relative rounded-2xl overflow-hidden bg-[#2C2D2F] shadow-lg border border-slate-800">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#F69F19]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-[#DE5532]/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4"></div>
        
        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Gerenciamento de Usuários
            </h1>
            <p className="text-slate-400 max-w-xl">
              Gerencie usuários do sistema, permissões e permissões de acesso.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              onClick={loadUsers} 
              disabled={loading} 
              className="bg-white/5 text-white border-white/20 hover:bg-white/10"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#F69F19] hover:bg-[#e08e12] text-white border-0" size="sm">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Preencha os dados abaixo para criar um novo usuário no sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome <span className="text-red-500">*</span></Label>
                  <Input
                    id="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Senha <span className="text-red-500">*</span></Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Senha (mínimo 6 caracteres)"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Função <span className="text-red-500">*</span></Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) => setNewUser({ ...newUser, role: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma função" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário</SelectItem>
                      <SelectItem value="lawyer">Advogado</SelectItem>
                      <SelectItem value="support">Suporte</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                      {/* No formulário de criação: */}
                      <Label htmlFor="department">Departamento/Área <span className="text-red-500">*</span></Label>
                      <Select
                        value={newUser.department || Department.GERAL}
                        onValueChange={(value) => setNewUser({ ...newUser, department: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o departamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Usar Object.values para iterar sobre o enum */}
                          {Object.values(Department).map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                    onClick={handleCreateUser} 
                    disabled={createLoading}
                    className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F] hover:shadow-sm"

                >
                  {createLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Usuário'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </div>

      {/* Modal de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nome <span className="text-red-500">*</span></Label>
                <Input
                  id="edit-name"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Função <span className="text-red-500">*</span></Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value) => setEditingUser({ ...editingUser, role: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="lawyer">Advogado</SelectItem>
                    <SelectItem value="support">Suporte</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                {/* E no formulário de edição: */}
                <Label htmlFor="edit-department">Departamento/Área <span className="text-red-500">*</span></Label>
                <Select
                  value={editingUser.department}
                  onValueChange={(value) => setEditingUser({ ...editingUser, department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Usar Object.values para iterar sobre o enum */}
                    {Object.values(Department).map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setEditDialogOpen(false)}
              disabled={editLoading}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={editLoading}
              className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F] hover:shadow-sm"
            >
              {editLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-[#F69F19]/20">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Usuários do Sistema</CardTitle>
              <CardDescription>
                Gerencie os usuários que têm acesso ao sistema. Use Desativar para preservar histórico.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowInactive(!showInactive);
              }}
              className="border-[#F69F19] text-[#2C2D2F] hover:bg-[#F69F19]/5"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showInactive ? 'Ocultar Inativos' : 'Mostrar Inativos'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-[#2C2D2F] mb-1">Filtros</h3>
              <p className="text-xs text-slate-500">Filtre os usuários por diferentes critérios</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Busca */}
              <div className="lg:col-span-2">
                <Label htmlFor="search" className="text-sm font-medium text-[#2C2D2F] mb-2 block">
                  Buscar
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    id="search"
                    placeholder="Nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filtro de Departamento */}
              <div>
                <Label htmlFor="department" className="text-sm font-medium text-[#2C2D2F] mb-2 block">
                  Departamento
                </Label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Departamentos</SelectItem>
                    {Object.values(Department).map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de Função */}
              <div>
                <Label htmlFor="role" className="text-sm font-medium text-[#2C2D2F] mb-2 block">
                  Função
                </Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Funções</SelectItem>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="support">Suporte</SelectItem>
                    <SelectItem value="lawyer">Advogado</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de Status (Ativo/Inativo) */}
              <div>
                <Label htmlFor="status" className="text-sm font-medium text-[#2C2D2F] mb-2 block">
                  Status
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="active">Apenas Ativos</SelectItem>
                    <SelectItem value="inactive">Apenas Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de Status Online */}
              <div>
                <Label htmlFor="online" className="text-sm font-medium text-[#2C2D2F] mb-2 block">
                  Online
                </Label>
                <Select value={onlineStatusFilter} onValueChange={setOnlineStatusFilter}>
                  <SelectTrigger id="online">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Botão Limpar Filtros */}
            {hasActiveFilters && (
              <div className="mt-4 flex justify-between items-center">
                <p className="text-sm text-slate-600">
                  Mostrando <strong>{filteredUsers.length}</strong> de <strong>{users.length}</strong> usuários
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="flex items-center gap-2 border-[#F69F19] text-[#2C2D2F] hover:bg-[#F69F19]/5"
                >
                  <X className="h-4 w-4" />
                  Limpar Filtros
                </Button>
              </div>
            )}
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-[#F69F19]" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Status Online</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {hasActiveFilters ? 'Nenhum usuário encontrado com os filtros selecionados' : 'Nenhum usuário encontrado'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((userItem) => (
                    <TableRow key={userItem.id}>
                      <TableCell>{userItem.name}</TableCell>
                      <TableCell>{userItem.email}</TableCell>
                      <TableCell>
                            <span className={`inline-block px-2 py-1 rounded text-xs ${
                              userItem.role === 'admin' 
                                ? 'bg-[#F69F19]/20 text-[#2C2D2F] font-medium' 
                                : userItem.role === 'lawyer'
                                ? 'bg-[#DE5532]/20 text-[#DE5532]'
                                : userItem.role === 'support'
                                ? 'bg-[#2C2D2F]/20 text-[#2C2D2F]'
                                : 'bg-[#F69F19]/10 text-[#2C2D2F]'
                            }`}>
                          {translateRole(userItem.role)}
                        </span>
                      </TableCell>
                      <TableCell>{userItem.department || 'Geral'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          userItem.isActive !== false 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {userItem.isActive !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${userItem.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                        {userItem.isOnline ? 'Online' : 'Offline'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditStart(userItem)}
                              className="hover:bg-[#F69F19]/10 hover:text-[#F69F19]"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4 text-[#DE5532]" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleUserStatusClick(userItem.id, userItem.name, userItem.isActive !== false)}
                              disabled={userItem.id === user?.id || toggleLoading === userItem.id}
                              className={`${
                                userItem.isActive !== false
                                  ? 'hover:bg-orange-100 hover:text-orange-600'
                                  : 'hover:bg-green-100 hover:text-green-600'
                              }`}
                              title={userItem.isActive !== false ? 'Desativar' : 'Ativar'}
                            >
                              {toggleLoading === userItem.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : userItem.isActive !== false ? (
                                <UserX className="h-4 w-4 text-orange-600" />
                              ) : (
                                <UserCheck className="h-4 w-4 text-green-600" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUser(userItem.id, userItem.name)}
                              disabled={userItem.id === user?.id || toggleLoading === userItem.id}
                              className="hover:bg-[#BD2D29]/10 hover:text-[#BD2D29]"
                              title="Excluir permanentemente"
                            >
                              <Trash2 className="h-4 w-4 text-[#BD2D29]" />
                            </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Confirmação de Ativação/Desativação */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="sm:max-w-[500px] border-[#F69F19]/20">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              {pendingAction?.currentStatus ? (
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-100">
                  <UserX className="h-6 w-6 text-orange-600" />
                </div>
              ) : (
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
                  <UserCheck className="h-6 w-6 text-green-600" />
                </div>
              )}
              <AlertDialogTitle className="text-xl font-semibold text-[#2C2D2F]">
                {pendingAction?.currentStatus ? 'Desativar Usuário' : 'Ativar Usuário'}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base text-slate-600 mt-4">
              {pendingAction?.currentStatus ? (
                <>
                  Tem certeza que deseja <strong className="text-orange-600 font-semibold">desativar</strong> o usuário{' '}
                  <strong className="text-[#2C2D2F]">{pendingAction.userName}</strong>?
                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-orange-800">
                        <p className="font-medium mb-1">O que acontece:</p>
                        <ul className="list-disc list-inside space-y-1 text-orange-700">
                          <li>O usuário não poderá mais fazer login no sistema</li>
                          <li>Não aparecerá nas listas de atendentes disponíveis</li>
                          <li>Todos os dados históricos serão preservados (tickets, métricas, etc.)</li>
                          <li>Você pode reativar o usuário a qualquer momento</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  Tem certeza que deseja <strong className="text-green-600 font-semibold">ativar</strong> o usuário{' '}
                  <strong className="text-[#2C2D2F]">{pendingAction?.userName}</strong>?
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex gap-2">
                      <UserCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-green-800">
                        <p className="font-medium mb-1">O que acontece:</p>
                        <ul className="list-disc list-inside space-y-1 text-green-700">
                          <li>O usuário poderá fazer login no sistema novamente</li>
                          <li>Aparecerá nas listas de atendentes disponíveis</li>
                          <li>Terá acesso completo ao sistema conforme sua função</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-6">
            <AlertDialogCancel
              onClick={() => {
                setConfirmDialogOpen(false);
                setPendingAction(null);
              }}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggleStatus}
              disabled={toggleLoading === pendingAction?.userId}
              className={`${
                pendingAction?.currentStatus
                  ? 'bg-orange-600 hover:bg-orange-700 text-white focus:ring-orange-600'
                  : 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-600'
              }`}
            >
              {toggleLoading === pendingAction?.userId ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : pendingAction?.currentStatus ? (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Desativar Usuário
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Ativar Usuário
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[500px] border-[#BD2D29]/20">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-[#2C2D2F]">
                Excluir Usuário Permanentemente
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base text-slate-600 mt-4">
              Tem certeza que deseja <strong className="text-red-600 font-semibold">excluir permanentemente</strong> o usuário{' '}
              <strong className="text-[#2C2D2F]">{pendingDelete?.userName}</strong>?
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium mb-1">⚠️ ATENÇÃO: Esta ação não pode ser desfeita!</p>
                    <p className="mb-2 text-red-700">O que acontece:</p>
                    <ul className="list-disc list-inside space-y-1 text-red-700">
                      <li>O usuário será removido permanentemente do sistema</li>
                      <li>Usuários que criaram tickets serão anonimizados (não excluídos)</li>
                      <li>O histórico de tickets será preservado</li>
                      <li>Esta ação não pode ser revertida</li>
                    </ul>
                    <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded">
                      <p className="text-orange-800 text-xs font-medium">
                        💡 Recomendamos <strong>DESATIVAR</strong> o usuário em vez de excluí-lo para preservar dados históricos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-6">
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false);
                setPendingDelete(null);
              }}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              {deleteLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Permanentemente
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}