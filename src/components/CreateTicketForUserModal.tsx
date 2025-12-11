import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Clock, User, Search, CheckCircle2, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { TicketService } from '@/services/ticketService';
import { useAuth } from '@/contexts/AuthContext';
import { CATEGORIES_CONFIG } from '@/components/TicketForm';
import { toast } from 'sonner';

interface CreateTicketForUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  department?: string;
}

const CreateTicketForUserModal: React.FC<CreateTicketForUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user: currentUser } = useAuth();
  
  // Estados do formulário
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [resolution, setResolution] = useState('');
  const [isAlreadyResolved, setIsAlreadyResolved] = useState(false);
  
  // Estados de controle
  const [users, setUsers] = useState<UserOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [slaHours, setSlaHours] = useState<number | null>(null);
  const [step, setStep] = useState<'user' | 'ticket'>('user');

  // Carregar usuários quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      loadUsers();
    } else {
      // Reset ao fechar
      resetForm();
    }
  }, [isOpen]);

  // Resetar subcategoria quando categoria muda
  useEffect(() => {
    setSubcategory('');
    setSlaHours(null);
  }, [category]);

  // Atualizar SLA quando subcategoria muda
  useEffect(() => {
    if (category && subcategory) {
      const selectedSubcategory = CATEGORIES_CONFIG[category]?.subcategories.find(
        sub => sub.value === subcategory
      );
      
      if (selectedSubcategory) {
        setSlaHours(selectedSubcategory.slaHours);
      } else {
        setSlaHours(null);
      }
    } else {
      setSlaHours(null);
    }
  }, [category, subcategory]);

  const resetForm = () => {
    setSelectedUser(null);
    setTitle('');
    setDescription('');
    setCategory('');
    setSubcategory('');
    setResolution('');
    setIsAlreadyResolved(false);
    setSearchTerm('');
    setErrors({});
    setStep('user');
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('app_c009c0e4f1_users')
        .select('id, name, email, department')
        .eq('role', 'user')
        .order('name');

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar lista de usuários');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!selectedUser) {
      newErrors.user = 'Selecione um usuário';
    }
    
    if (!title.trim()) {
      newErrors.title = 'O título é obrigatório';
    } else if (title.length < 5) {
      newErrors.title = 'O título deve ter pelo menos 5 caracteres';
    }
    
    if (!description.trim()) {
      newErrors.description = 'A descrição é obrigatória';
    } else if (description.length < 10) {
      newErrors.description = 'A descrição deve ter pelo menos 10 caracteres';
    }
    
    if (!category) {
      newErrors.category = 'A categoria é obrigatória';
    }
    
    if (!subcategory && category) {
      newErrors.subcategory = 'A subcategoria é obrigatória';
    }

    if (isAlreadyResolved && !resolution.trim()) {
      newErrors.resolution = 'A resolução é obrigatória quando o ticket já foi resolvido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !selectedUser || !currentUser) {
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Criar o ticket
      const ticketData = {
        title,
        description,
        category,
        subcategory,
        createdBy: selectedUser.id,
        createdByName: selectedUser.name,
        createdByDepartment: selectedUser.department,
      };

      const newTicket = await TicketService.createTicket(ticketData);

      if (!newTicket) {
        throw new Error('Falha ao criar ticket');
      }

      // 2. Se já foi resolvido, processar imediatamente
      if (isAlreadyResolved && resolution.trim()) {
        // Atribuir ao usuário atual (suporte)
        await TicketService.updateTicket(newTicket.id, {
          status: 'assigned',
          assignedTo: currentUser.id,
          assignedToName: currentUser.name,
          assignedBy: currentUser.id,
          assignedAt: new Date().toISOString(),
        });

        // Iniciar atendimento
        await TicketService.updateTicket(newTicket.id, {
          status: 'in_progress',
          startedAt: new Date().toISOString(),
        });

        // Adicionar mensagem de resolução
        await TicketService.sendChatMessage(
          newTicket.id,
          currentUser.id,
          currentUser.name,
          `✅ **Atendimento Presencial Registrado**\n\n${resolution}`,
          []
        );

        // Finalizar ticket
        await TicketService.updateTicket(newTicket.id, {
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        });

        toast.success('Ticket criado e resolvido com sucesso! O usuário receberá uma notificação para avaliar o atendimento.');
      } else {
        toast.success('Ticket criado com sucesso! O usuário foi notificado.');
      }

      onSuccess();
      onClose();

    } catch (error: any) {
      console.error('Erro ao criar ticket:', error);
      toast.error(error.message || 'Erro ao criar ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserSelect = (user: UserOption) => {
    setSelectedUser(user);
    setStep('ticket');
  };

  const handleBackToUserSelection = () => {
    setStep('user');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <User className="h-5 w-5 text-[#D5B170]" />
            Criar Ticket para Usuário
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {step === 'user' 
              ? "Selecione o usuário para quem você está criando o ticket."
              : `Criando ticket para: ${selectedUser?.name} (${selectedUser?.email})`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'user' ? (
          // Etapa 1: Seleção do usuário
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar Usuário</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Digite o nome ou email do usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isLoadingUsers ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D5B170] mx-auto mb-4"></div>
                <p className="text-slate-500">Carregando usuários...</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum usuário encontrado</p>
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-800">{user.name}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                          {user.department && (
                            <p className="text-xs text-slate-400">{user.department}</p>
                          )}
                        </div>
                        <Button size="sm" variant="outline">
                          Selecionar
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          // Etapa 2: Formulário do ticket
          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <User className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-blue-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedUser?.name}</p>
                    <p className="text-sm">{selectedUser?.email}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBackToUserSelection}
                  >
                    Alterar Usuário
                  </Button>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="title">Título do Ticket</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Problema com senha do tribunal"
                className={errors.title ? 'border-red-500' : ''}
              />
              {errors.title && (
                <p className="text-red-500 text-xs flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errors.title}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição do Problema/Solicitação</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o que o usuário relatou ou solicitou..."
                rows={4}
                className={errors.description ? 'border-red-500' : ''}
              />
              {errors.description && (
                <p className="text-red-500 text-xs flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errors.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-red-500 text-xs flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errors.category}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subcategory">Subcategoria</Label>
                <Select
                  value={subcategory}
                  onValueChange={setSubcategory}
                  disabled={!category}
                >
                  <SelectTrigger className={errors.subcategory ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione uma subcategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {category && CATEGORIES_CONFIG[category]?.subcategories.map((sub) => (
                      <SelectItem key={sub.value} value={sub.value}>
                        {sub.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subcategory && (
                  <p className="text-red-500 text-xs flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errors.subcategory}
                  </p>
                )}
              </div>
            </div>

            {slaHours !== null && (
              <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
                <div className="flex items-center text-sm text-slate-700">
                  <Clock className="h-4 w-4 mr-2 text-blue-500" />
                  <span>
                    <strong>Tempo estimado de atendimento:</strong> {slaHours} {slaHours === 1 ? 'hora' : 'horas'}
                  </span>
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-4">
                <Switch
                  id="resolved"
                  checked={isAlreadyResolved}
                  onCheckedChange={setIsAlreadyResolved}
                />
                <Label htmlFor="resolved" className="text-sm font-medium">
                  Este problema já foi resolvido presencialmente
                </Label>
              </div>

              {isAlreadyResolved && (
                <div className="space-y-2">
                  <Label htmlFor="resolution">Resolução Aplicada</Label>
                  <Textarea
                    id="resolution"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Descreva como o problema foi resolvido..."
                    rows={3}
                    className={errors.resolution ? 'border-red-500' : ''}
                  />
                  {errors.resolution && (
                    <p className="text-red-500 text-xs flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {errors.resolution}
                    </p>
                  )}
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-700 text-sm">
                      O ticket será criado como <strong>resolvido</strong> e o usuário receberá uma notificação para avaliar o atendimento.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleBackToUserSelection}
                disabled={isSubmitting}
              >
                ← Voltar
              </Button>
              <div className="space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-[#D5B170] hover:bg-[#c4a05f] text-white"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Criando...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {isAlreadyResolved ? 'Criar e Resolver' : 'Criar Ticket'}
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateTicketForUserModal;