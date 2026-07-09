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
import { AlertCircle, Clock, User, Search, CheckCircle2, MessageSquare, ArrowLeft, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TicketService } from '@/services/ticketService';
import { UserService } from '@/services/userService';
import { useAuth } from '@/contexts/AuthContext';
import { CategoryService } from '@/services/categoryService';
import { toast } from 'sonner';
import DesenvolvimentoContinuoFields from '@/components/DesenvolvimentoContinuoFields';
import {
  buildDesenvolvimentoContinuoChatMessage,
  buildDesenvolvimentoContinuoDescription,
  buildDesenvolvimentoContinuoTitle,
  buildSharepointTreinamentoPayload,
  emptyDesenvolvimentoContinuoForm,
  isDesenvolvimentoContinuoCategory,
  validateDesenvolvimentoContinuoForm,
  type DesenvolvimentoContinuoFormData,
} from '@/utils/desenvolvimentoContinuoForm';
import { useDesenvolvimentoContinuoOptions } from '@/hooks/useDesenvolvimentoContinuoOptions';
import { isInverseTicketFlow } from '@/utils/inverseTicketFlow';
import RequisicaoPessoalFields from '@/components/RequisicaoPessoalFields';
import {
  buildRequisicaoPessoalChatMessage,
  buildRequisicaoPessoalDescription,
  buildRequisicaoPessoalTitle,
  emptyRequisicaoPessoalForm,
  isRequisicaoPessoalSelection,
  validateRequisicaoPessoalForm,
  type RequisicaoPessoalFormData,
} from '@/utils/requisicaoPessoalForm';

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
  const [frenteId, setFrenteId] = useState('');
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
  const [categoriesConfig, setCategoriesConfig] = useState<Record<string, { label: string; tagId?: string; subcategories: { value: string; label: string; slaHours: number }[] }>>({});
  const [frentes, setFrentes] = useState<{ id: string; label: string; color: string }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [dcForm, setDcForm] = useState<DesenvolvimentoContinuoFormData>(emptyDesenvolvimentoContinuoForm());
  const [reqForm, setReqForm] = useState<RequisicaoPessoalFormData>(emptyRequisicaoPessoalForm());

  const isDcCategory = isDesenvolvimentoContinuoCategory(category);
  const isReqPessoalCategory = isRequisicaoPessoalSelection(category, subcategory);
  const isInverseFlow = isInverseTicketFlow(category, subcategory);
  const { users: dcUsers, departments: dcDepartments, loading: dcOptionsLoading } =
    useDesenvolvimentoContinuoOptions(isDcCategory);

  // Gradiente oficial da marca
  const brandGradient = 'linear-gradient(90deg, rgba(246, 159, 25, 1) 0%, rgba(222, 85, 50, 1) 50%, rgba(189, 45, 41, 1) 100%)';

  // Carregar categorias e frentes do banco de dados
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingCategories(true);
        const [config, tags] = await Promise.all([
          CategoryService.getCategoriesConfig(),
          CategoryService.getAllTags(false)
        ]);
        setCategoriesConfig(config);
        setFrentes(tags.map(t => ({ id: t.id, label: t.label, color: t.color })));
      } catch (error) {
        console.error('Erro ao carregar categorias do banco:', error);
        setCategoriesConfig({});
        setFrentes([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Carregar usuários quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      loadUsers();
    } else {
      // Reset ao fechar
      resetForm();
    }
  }, [isOpen]);

  // Resetar categoria e subcategoria quando a frente muda
  useEffect(() => {
    setCategory('');
    setSubcategory('');
    setSlaHours(null);
    setDcForm(emptyDesenvolvimentoContinuoForm());
    setReqForm(emptyRequisicaoPessoalForm());
  }, [frenteId]);

  // Resetar subcategoria quando categoria muda
  useEffect(() => {
    setSubcategory('');
    setSlaHours(null);
    setDcForm(emptyDesenvolvimentoContinuoForm());
    setReqForm(emptyRequisicaoPessoalForm());
  }, [category]);

  // Categorias filtradas pela frente selecionada
  const categoriesByFrente = frenteId === ''
    ? Object.entries(categoriesConfig)
    : frenteId === 'sem-frente'
      ? Object.entries(categoriesConfig).filter(([, c]) => !c.tagId)
      : Object.entries(categoriesConfig).filter(([, c]) => c.tagId === frenteId);

  // Atualizar SLA quando subcategoria muda
  useEffect(() => {
    if (category && subcategory) {
      const selectedSubcategory = categoriesConfig[category]?.subcategories.find(
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
  }, [category, subcategory, categoriesConfig]);

  const resetForm = () => {
    setSelectedUser(null);
    setTitle('');
    setDescription('');
    setFrenteId('');
    setCategory('');
    setSubcategory('');
    setResolution('');
    setIsAlreadyResolved(false);
    setDcForm(emptyDesenvolvimentoContinuoForm());
    setReqForm(emptyRequisicaoPessoalForm());
    setSearchTerm('');
    setErrors({});
    setStep('user');
  };

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const juridicoUsers = await UserService.getActiveJuridicoUsers();
      setUsers(
        juridicoUsers.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          department: user.department,
        })),
      );
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

    if (isDcCategory) {
      if (!subcategory) {
        newErrors.subcategory = 'A subcategoria é obrigatória';
      }
      Object.assign(newErrors, validateDesenvolvimentoContinuoForm(dcForm));
    } else if (isReqPessoalCategory) {
      Object.assign(newErrors, validateRequisicaoPessoalForm(reqForm));
    } else {
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
    }

    if (!frenteId) {
      newErrors.frente = 'Selecione a frente de atuação';
    }

    if (!category) {
      newErrors.category = 'A categoria é obrigatória';
    }

    if (!subcategory && category && !isDcCategory) {
      newErrors.subcategory = 'A subcategoria é obrigatória';
    }

    if (isInverseFlow) {
      newErrors.subcategory =
        'Para Auditoria de excludentes, use Novo Ticket e selecione quem vai atender.';
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
      let ticketTitle = title;
      let ticketDescription = description;
      let initialChatMessage: string | undefined;
      let sharepointTreinamento: ReturnType<typeof buildSharepointTreinamentoPayload> | undefined;

      if (isDcCategory) {
        const subcategoryLabel =
          categoriesConfig[category]?.subcategories.find((s) => s.value === subcategory)?.label ??
          subcategory;
        const categoryLabel = categoriesConfig[category]?.label ?? category;

        ticketTitle = buildDesenvolvimentoContinuoTitle(subcategoryLabel, dcForm.tema);
        ticketDescription = buildDesenvolvimentoContinuoDescription(dcForm, subcategoryLabel, dcUsers);
        initialChatMessage = buildDesenvolvimentoContinuoChatMessage(
          dcForm,
          subcategoryLabel,
          categoryLabel,
          dcUsers,
        );
        sharepointTreinamento = buildSharepointTreinamentoPayload(
          dcForm,
          subcategoryLabel,
          dcUsers,
        );
      } else if (isReqPessoalCategory) {
        const requester = { name: selectedUser.name, department: selectedUser.department };
        ticketTitle = buildRequisicaoPessoalTitle(reqForm);
        ticketDescription = buildRequisicaoPessoalDescription(reqForm, requester);
        initialChatMessage = buildRequisicaoPessoalChatMessage(reqForm, requester);
      }

      const ticketData = {
        title: ticketTitle,
        description: ticketDescription,
        category,
        subcategory,
        createdBy: selectedUser.id,
        createdByName: selectedUser.name,
        createdByDepartment: selectedUser.department,
        skipFeedbackCheck: true,
        initialChatMessage,
        sharepointTreinamento,
      };

      const newTicket = await TicketService.createTicket(ticketData);

      if (!newTicket) {
        throw new Error('Falha ao criar ticket');
      }

      if (isReqPessoalCategory && reqForm.aprovacaoSocio === 'sim' && reqForm.anexoAprovacao) {
        try {
          const attachment = await TicketService.uploadAttachment(newTicket.id, reqForm.anexoAprovacao);
          await TicketService.sendChatMessage(
            newTicket.id,
            selectedUser.id,
            selectedUser.name,
            '✅ Comprovante do "de acordo" do sócio — referente à Ficha de Requisição de Pessoal acima.',
            [attachment],
          );
        } catch (uploadError) {
          console.error('Erro ao anexar comprovante:', uploadError);
          toast.error('Ticket criado, mas houve um erro ao anexar o comprovante. Anexe manualmente pelo chat.');
        }
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 shadow-2xl">
        {/* Barra de gradiente no topo */}
        <div className="h-[3px] w-full" style={{ background: brandGradient }}></div>

        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl font-bold text-[#2C2D2F] flex items-center gap-2">
              <div className="p-2 bg-[#F69F19]/10 rounded-lg">
                <User className="h-5 w-5 text-[#F69F19]" />
              </div>
              Criar Ticket para Usuário
            </DialogTitle>
            <DialogDescription className="text-slate-500 ml-11">
              {step === 'user' 
                ? "Selecione o usuário para quem você está criando o ticket."
                : "Preencha os detalhes da solicitação abaixo."
              }
            </DialogDescription>
          </DialogHeader>

          {step === 'user' ? (
            // Etapa 1: Seleção do usuário
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label htmlFor="search" className="text-[#2C2D2F] font-medium">Buscar Usuário</Label>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-[#F69F19] transition-colors h-4 w-4" />
                  <Input
                    id="search"
                    placeholder="Digite o nome ou email do usuário..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-slate-300 focus:border-[#F69F19] focus:ring-[#F69F19]/20"
                  />
                </div>
              </div>

              {isLoadingUsers ? (
                <div className="py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F69F19] mx-auto mb-4"></div>
                  <p className="text-slate-500">Carregando usuários...</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>Nenhum usuário encontrado</p>
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleUserSelect(user)}
                        className="group p-3 border border-slate-200 rounded-lg hover:bg-[#F69F19]/5 hover:border-[#F69F19]/30 cursor-pointer transition-all duration-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[#F69F19] group-hover:text-white transition-colors">
                              <span className="text-xs font-bold">{user.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="font-medium text-[#2C2D2F] group-hover:text-[#DE5532] transition-colors">{user.name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                             {user.department && (
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full mb-1">
                                  {user.department}
                                </span>
                              )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            // Etapa 2: Formulário do ticket
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Card de Usuário Selecionado - Estilo Dark */}
              <div className="bg-[#2C2D2F] rounded-lg p-4 flex items-center justify-between shadow-md relative overflow-hidden group">
                <div className="absolute right-0 top-0 h-full w-1 bg-[#F69F19]"></div>
                <div className="flex items-center gap-3 relative z-10">
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                    <User className="h-5 w-5 text-[#F69F19]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Criando para</p>
                    <p className="font-bold text-white text-sm">{selectedUser?.name}</p>
                    <p className="text-xs text-slate-400">{selectedUser?.email}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleBackToUserSelection}
                  className="text-slate-300 hover:text-white hover:bg-white/10"
                >
                  Alterar
                </Button>
              </div>

              {/* 1º passo: Frente de Atuação */}
              <div className="space-y-2">
                <Label htmlFor="frente" className="text-[#2C2D2F]">Frente de Atuação <span className="text-red-500">*</span></Label>
                <Select value={frenteId} onValueChange={setFrenteId}>
                  <SelectTrigger className={`border-slate-300 focus:ring-[#F69F19]/20 ${errors.frente ? 'border-[#BD2D29]' : ''}`}>
                    <SelectValue placeholder="Selecione a frente de atuação" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingCategories ? (
                      <div className="px-2 py-1.5 text-sm text-slate-500">Carregando...</div>
                    ) : (
                      <>
                        <SelectItem value="sem-frente">Sem Frente de Atuação</SelectItem>
                        {frentes.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                              {f.label}
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                {errors.frente && (
                  <p className="text-[#BD2D29] text-xs flex items-center mt-1">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errors.frente}
                  </p>
                )}
              </div>

              {!frenteId ? (
                <div className="text-center py-8 px-4 text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                  Selecione a frente de atuação acima para preencher o restante da solicitação.
                </div>
              ) : (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* 2º passo: Categoria e Subcategoria */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-[#2C2D2F]">Categoria</Label>
                      <Select value={category} onValueChange={setCategory} disabled={!frenteId}>
                        <SelectTrigger className={`border-slate-300 focus:ring-[#F69F19]/20 ${errors.category ? 'border-[#BD2D29]' : ''}`}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriesByFrente.map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.category && (
                        <p className="text-[#BD2D29] text-xs flex items-center mt-1">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {errors.category}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subcategory" className="text-[#2C2D2F]">Subcategoria</Label>
                      <Select
                        value={subcategory}
                        onValueChange={setSubcategory}
                        disabled={!category}
                      >
                        <SelectTrigger className={`border-slate-300 focus:ring-[#F69F19]/20 ${errors.subcategory ? 'border-[#BD2D29]' : ''}`}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {category &&
                            categoriesConfig[category]?.subcategories
                              .filter((sub) => !isInverseTicketFlow(category, sub.value))
                              .map((sub) => (
                            <SelectItem key={sub.value} value={sub.value}>
                              {sub.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.subcategory && (
                        <p className="text-[#BD2D29] text-xs flex items-center mt-1">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {errors.subcategory}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 3º passo: campos da solicitação - só após escolher categoria e subcategoria */}
                  {!category || !subcategory ? (
                    <div className="text-center py-8 px-4 text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                      Selecione a categoria e a subcategoria para preencher os demais campos.
                    </div>
                  ) : (
                    <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                      {!isDcCategory && !isReqPessoalCategory && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="title" className="text-[#2C2D2F]">Título do Ticket</Label>
                            <Input
                              id="title"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              placeholder="Ex: Problema com senha do tribunal"
                              className={`border-slate-300 focus:border-[#F69F19] focus:ring-[#F69F19]/20 ${errors.title ? 'border-[#BD2D29]' : ''}`}
                            />
                            {errors.title && (
                              <p className="text-[#BD2D29] text-xs flex items-center mt-1">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {errors.title}
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="description" className="text-[#2C2D2F]">Descrição do Problema/Solicitação</Label>
                            <Textarea
                              id="description"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Descreva o que o usuário relatou ou solicitou..."
                              rows={4}
                              className={`border-slate-300 focus:border-[#F69F19] focus:ring-[#F69F19]/20 ${errors.description ? 'border-[#BD2D29]' : ''}`}
                            />
                            {errors.description && (
                              <p className="text-[#BD2D29] text-xs flex items-center mt-1">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {errors.description}
                              </p>
                            )}
                          </div>
                        </>
                      )}

                      {isDcCategory && (
                        <DesenvolvimentoContinuoFields
                          data={dcForm}
                          onChange={setDcForm}
                          errors={errors}
                          users={dcUsers}
                          departments={dcDepartments}
                          loading={dcOptionsLoading}
                        />
                      )}

                      {isReqPessoalCategory && (
                        <RequisicaoPessoalFields
                          data={reqForm}
                          onChange={setReqForm}
                          errors={errors}
                        />
                      )}

                      {slaHours !== null && (
                        <div className="bg-[#F69F19]/5 p-3 rounded-md border border-[#F69F19]/20 flex items-center gap-3">
                          <div className="p-1.5 bg-white rounded-full shadow-sm">
                            <Clock className="h-4 w-4 text-[#F69F19]" />
                          </div>
                          <span className="text-sm text-slate-700">
                            Tempo estimado de atendimento: <strong>{slaHours} {slaHours === 1 ? 'hora' : 'horas'}</strong>
                          </span>
                        </div>
                      )}

                      <div className="border-t border-slate-100 pt-4 mt-2">
                        <div className="flex items-center space-x-2 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <Switch
                            id="resolved"
                            checked={isAlreadyResolved}
                            onCheckedChange={setIsAlreadyResolved}
                            className="data-[state=checked]:bg-[#F69F19]"
                          />
                          <Label htmlFor="resolved" className="text-sm font-medium text-[#2C2D2F] cursor-pointer">
                            Este problema já foi resolvido presencialmente
                          </Label>
                        </div>

                        {isAlreadyResolved && (
                          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <Label htmlFor="resolution" className="text-[#2C2D2F]">Resolução Aplicada</Label>
                            <Textarea
                              id="resolution"
                              value={resolution}
                              onChange={(e) => setResolution(e.target.value)}
                              placeholder="Descreva como o problema foi resolvido..."
                              rows={3}
                              className={`border-slate-300 focus:border-[#F69F19] focus:ring-[#F69F19]/20 ${errors.resolution ? 'border-[#BD2D29]' : ''}`}
                            />
                            {errors.resolution && (
                              <p className="text-[#BD2D29] text-xs flex items-center mt-1">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {errors.resolution}
                              </p>
                            )}
                            <Alert className="bg-green-50 border-green-200 mt-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <AlertDescription className="text-green-800 text-xs">
                                O ticket será criado como <strong>resolvido</strong> e o usuário receberá uma notificação para avaliar o atendimento.
                              </AlertDescription>
                            </Alert>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="flex justify-between pt-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToUserSelection}
                  disabled={isSubmitting}
                  className="border-slate-200 hover:bg-slate-50 text-slate-600"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !frenteId || !category || !subcategory}
                    className="text-white font-bold shadow-md border-0"
                    style={{ background: brandGradient }}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTicketForUserModal;
