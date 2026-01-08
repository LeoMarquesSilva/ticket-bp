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
import { PlusCircle, Trash2, RefreshCw, Pencil } from 'lucide-react';


export default function UserManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
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
      const data = await UserService.getAllUsers();
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

// Excluir usuário - MÉTODO CORRIGIDO
const handleDeleteUser = async (userId: string, userName: string) => {
  if (!confirm(`Tem certeza que deseja excluir o usuário ${userName}? 
  
Esta ação não pode ser desfeita. 

Nota: Usuários que criaram tickets serão anonimizados em vez de excluídos para preservar o histórico.`)) {
    return;
  }

  try {
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
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#2C2D2F]">Gerenciamento de Usuários</h1>

        
        <div className="flex gap-2">
            <Button variant="outline" onClick={loadUsers} disabled={loading} className="border-[#F69F19] text-[#2C2D2F] hover:bg-[#F69F19]/5">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
                <Button className="bg-[#F69F19] hover:bg-[#F69F19]/90 text-[#2C2D2F] hover:shadow-sm">
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
          <CardTitle>Usuários do Sistema</CardTitle>
          <CardDescription>
            Gerencie os usuários que têm acesso ao sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((userItem) => (
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
                            >
                              <Pencil className="h-4 w-4 text-[#DE5532]" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteUser(userItem.id, userItem.name)}
                              disabled={userItem.id === user?.id}
                              className="hover:bg-[#BD2D29]/10 hover:text-[#BD2D29]"
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
    </div>
  );
}