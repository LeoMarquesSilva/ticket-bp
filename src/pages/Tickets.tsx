import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Ticket } from '@/types';
import { TicketService, ChatMessage } from '@/services/ticketService';
import TicketForm from '@/components/TicketForm';
import TicketHeader from '@/components/TicketHeader';
import TicketKanbanBoard from '@/components/TicketKanbanBoard';
import TicketUserBoard from '@/components/TicketUserBoard';
import TicketList from '@/components/TicketList';
import TicketChatPanel from '@/components/TicketChatPanel';
import SimpleTicketCard from '@/components/SimpleTicketCard';

const Tickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [view, setView] = useState<'list' | 'board' | 'users'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [supportUsers, setSupportUsers] = useState<any[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const [showImagePreview, setShowImagePreview] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageSubscription = useRef<any>(null);
  const typingSubscription = useRef<any>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadTickets();
    loadSupportUsers();
    
    // Monitorar status da conexão com Supabase
        const channel = supabase.channel('system');
        const connectionData = channel
          .on('system', { event: 'connection_status' }, (payload) => {
            setConnectionStatus(payload.status);
          })
          .subscribe();
    
    return () => {
      // Limpar assinaturas ao desmontar
      if (messageSubscription.current) {
        messageSubscription.current.unsubscribe();
      }
      if (typingSubscription.current) {
        typingSubscription.current.unsubscribe();
      }
      if (connectionData) {
        connectionData.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedTicket?.id) {
      loadMessages(selectedTicket.id);
      setupMessageSubscription();
    }
  }, [selectedTicket?.id]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let tickets;
      
      if (user?.role === 'user') {
        // Usuários comuns veem apenas seus próprios tickets
        tickets = await TicketService.getUserTickets(user.id);
      } else {
        // Admins e suporte veem todos os tickets
        tickets = await TicketService.getAllTickets();
      }
      
      setTickets(tickets);
      
      // Carregar contagem de mensagens não lidas para cada ticket
      if (tickets.length > 0) {
        loadUnreadMessageCounts(tickets);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      setError('Erro ao carregar tickets. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const loadSupportUsers = async () => {
    try {
      const users = await TicketService.getSupportUsers();
      setSupportUsers(users);
    } catch (error) {
      console.error('Error loading support users:', error);
    }
  };

  const loadMessages = async (ticketId: string) => {
    try {
      setLoadingMessages(true);
      const messages = await TicketService.getTicketMessages(ticketId);
      setChatMessages(messages);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadUnreadMessageCounts = async (ticketsList: Ticket[]) => {
    try {
      const counts = await TicketService.getUnreadMessageCounts(user?.id || '');
      setUnreadMessages(counts);
    } catch (error) {
      console.error('Error loading unread message counts:', error);
    }
  };

  const markMessagesAsRead = async (ticketId: string) => {
    if (!user?.id) return;
    
    try {
      await TicketService.markMessagesAsRead(ticketId, user.id);
      
      // Atualizar o contador local
      setUnreadMessages(prev => ({
        ...prev,
        [ticketId]: 0
      }));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Função para notificar que o usuário está digitando
  const handleTyping = () => {
    if (!selectedTicket?.id || !user?.id) return;
    
    // Enviar evento de digitação
    try {
      supabase.channel(`typing-${selectedTicket.id}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, userName: user.name }
      });
    } catch (error) {
      console.error('Error sending typing event:', error);
    }
    
    // Limpar timeout anterior se existir
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    
    // Definir novo timeout para parar de mostrar "digitando" após 2 segundos
    typingTimeout.current = setTimeout(() => {
      try {
        supabase.channel(`typing-${selectedTicket.id}`).send({
          type: 'broadcast',
          event: 'stop-typing',
          payload: { userId: user.id }
        });
      } catch (error) {
        console.error('Error sending stop-typing event:', error);
      }
    }, 2000);
  };

  // Configurar assinatura para eventos de digitação
  const setupTypingSubscription = () => {
    if (!selectedTicket?.id || !user?.id) return;
    
    // Cancelar assinatura anterior se existir
    if (typingSubscription.current) {
      typingSubscription.current.unsubscribe();
    }
    
    // Assinar a eventos de digitação
    typingSubscription.current = supabase
      .channel(`typing-${selectedTicket.id}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        // Ignorar eventos do próprio usuário
        if (payload.payload.userId === user.id) return;
        
        // Adicionar usuário à lista de digitando
        setTypingUsers(prev => ({
          ...prev,
          [payload.payload.userId]: payload.payload.userName
        }));
      })
      .on('broadcast', { event: 'stop-typing' }, (payload) => {
        // Remover usuário da lista de digitando
        setTypingUsers(prev => {
          const newTyping = { ...prev };
          delete newTyping[payload.payload.userId];
          return newTyping;
        });
      })
      .subscribe();
  };

  // Enviar mensagem
  const sendMessage = async () => {
    if (!selectedTicket?.id || !user?.id || (!newMessage.trim() && uploadingFiles.length === 0)) return;
    
    const tempMessageId = `temp-${Date.now()}`;
    const attachments = uploadingFiles
      .filter(file => file.progress === 100 && file.url)
      .map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        url: file.url
      }));
    
    // Adicionar mensagem temporária ao estado
    const tempMessage = {
      id: tempMessageId,
      ticketId: selectedTicket.id,
      userId: user.id,
      userName: user.name,
      message: newMessage.trim(),
      attachments,
      createdAt: new Date().toISOString(),
      read: false,
      isTemp: true
    };
    
    setChatMessages(prev => [...prev, tempMessage]);
    
    try {
      setSending(true);
      
      // Enviar mensagem para o servidor
      const newMessageData = await TicketService.sendMessage({
        ticketId: selectedTicket.id,
        userId: user.id,
        userName: user.name,
        message: newMessage.trim(),
        attachments
      });
      
      // Atualizar o ticket para "em andamento" se estiver aberto
      if (selectedTicket.status === 'open' && user.role !== 'user') {
        await handleUpdateTicket(selectedTicket.id, { status: 'in_progress' });
      }
      
      // Substituir a mensagem temporária pela real
      if (newMessageData && newMessageData.id) {
        setChatMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === tempMessageId ? { ...newMessageData, isTemp: false } : msg
          )
        );
      }
      
      setNewMessage('');
      setUploadingFiles([]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
      
      // Remover a mensagem temporária em caso de erro
      setChatMessages(prevMessages => 
        prevMessages.filter(msg => !msg.isTemp)
      );
    } finally {
      setSending(false);
    }
  };

  // Função para configurar a assinatura do Supabase para novas mensagens
  const setupMessageSubscription = () => {
    if (!selectedTicket?.id || !user?.id) return;
    
    // Cancelar assinatura anterior se existir
    if (messageSubscription.current) {
      messageSubscription.current.unsubscribe();
    }
    
    console.log('Setting up message subscription for ticket:', selectedTicket.id);
    
    // Assinar a novas mensagens para este ticket
    messageSubscription.current = supabase
      .channel(`ticket-messages-${selectedTicket.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `ticket_id=eq.${selectedTicket.id}`
      }, (payload) => {
        console.log('Received new message from Supabase:', payload);
        const newMessage = {
          id: payload.new.id,
          ticketId: payload.new.ticket_id,
          userId: payload.new.user_id,
          userName: payload.new.user_name,
          message: payload.new.message,
          attachments: payload.new.attachments || [],
          createdAt: payload.new.created_at,
          read: payload.new.read
        };
        
        // Verificar se a mensagem já existe no estado (para evitar duplicação)
        setChatMessages(prevMessages => {
          // Verificar se já existe uma mensagem com este ID ou uma mensagem temporária com o mesmo conteúdo
          const messageExists = prevMessages.some(
            msg => msg.id === newMessage.id || 
                  (msg.isTemp && 
                   msg.userId === newMessage.userId && 
                   msg.message === newMessage.message)
          );
          
          if (messageExists) {
            // Se a mensagem já existe, apenas substituir a temporária se houver
            return prevMessages.map(msg => 
              (msg.isTemp && 
               msg.userId === newMessage.userId && 
               msg.message === newMessage.message) 
                ? { ...newMessage, isTemp: false } 
                : msg
            );
          } else {
            // Se a mensagem não existe, adicionar ao estado
            return [...prevMessages, newMessage];
          }
        });
        
        // Marcar como lida se for de outro usuário e o chat estiver aberto
        if (newMessage.userId !== user.id) {
          markMessagesAsRead(selectedTicket.id);
        }
        
        // Rolar para o final da conversa
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `ticket_id=eq.${selectedTicket.id}`
      }, (payload) => {
        console.log('Message updated:', payload);
        // Atualizar o estado das mensagens quando uma mensagem for atualizada
        // (por exemplo, quando for marcada como lida)
        setChatMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === payload.new.id 
            ? {
                ...msg,
                read: payload.new.read
              }
            : msg
          )
        );
      })
      .subscribe((status) => {
        console.log('Supabase subscription status:', status);
      });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

const handleCreateTicket = async (ticketData: any) => {
  if (!user) return;

  try {
    console.log('Creating ticket:', ticketData);
    const newTicket = await TicketService.createTicket({
      title: ticketData.title,
      description: ticketData.description,
      category: ticketData.category,
      subcategory: ticketData.subcategory,
      createdBy: user.id,
      createdByName: user.name,
    });
    
    console.log('Ticket created:', newTicket);
    
    if (newTicket && newTicket.id) {
      setTickets(prev => [newTicket, ...prev]);
      setShowCreateForm(false);
      toast.success('Ticket criado com sucesso!');
    }
  } catch (error) {
    console.error('Error creating ticket:', error);
    toast.error('Erro ao criar ticket');
  }
};

  const handleUpdateTicket = async (ticketId: string, updates: any) => {
    try {
      console.log('Updating ticket:', ticketId, updates);
      
      const updatedTicket = await TicketService.updateTicket(ticketId, updates);
      
      if (updatedTicket && updatedTicket.id) {
        setTickets(prev => prev.map(ticket => 
          ticket && ticket.id === ticketId ? updatedTicket : ticket
        ).filter(ticket => ticket && ticket.id));
        
        // Update selected ticket if it's the one being updated
        if (selectedTicket && selectedTicket.id === ticketId) {
          setSelectedTicket(updatedTicket);
        }
        
        toast.success('Ticket atualizado com sucesso!');
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast.error('Erro ao atualizar ticket');
    }
  };

  const handleAssignTicket = async (ticketId: string, supportUserId: string) => {
    try {
      await handleUpdateTicket(ticketId, { 
        assignedTo: supportUserId,
        status: 'in_progress'
      });
    } catch (error) {
      console.error('Error assigning ticket:', error);
      toast.error('Erro ao atribuir ticket');
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      const success = await TicketService.deleteTicket(ticketId);
      if (success) {
        setTickets(prev => prev.filter(ticket => ticket.id !== ticketId));
        
        // Se o ticket excluído for o que está sendo visualizado, feche o chat
        if (selectedTicket && selectedTicket.id === ticketId) {
          closeChat();
        }
        
        toast.success('Ticket excluído com sucesso!');
      }
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast.error('Erro ao excluir ticket');
    }
  };

  // Função para upload de arquivos
  const handleFileUpload = async (files: FileList) => {
    if (!files || files.length === 0 || !selectedTicket?.id) return;
    
    // Verificar se o ticket está finalizado
    if (isTicketFinalized(selectedTicket)) {
      toast.error('Este ticket está finalizado e não pode receber novos anexos');
      return;
    }
    
    // Verificar tamanho total (limite de 10MB por arquivo)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`O arquivo ${file.name} excede o limite de 10MB`);
        continue;
      }
      
      // Adicionar arquivo à lista de uploads com progresso 0
      const fileId = `${Date.now()}-${i}`;
      const newFile = {
        id: fileId,
        file: file,
        name: file.name,
        type: file.type,
        size: file.size,
        progress: 0,
        url: null,
        error: null
      };
      
      setUploadingFiles(prev => [...prev, newFile]);
      
      try {
        // Atualizar progresso para simular início do upload
        setUploadingFiles(prev => 
          prev.map(f => f.id === fileId ? { ...f, progress: 10 } : f)
        );
        
        // Criar nome único para o arquivo
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `tickets/${selectedTicket.id}/${fileName}`;
        
        // Simular progresso antes do upload
        setUploadingFiles(prev => 
          prev.map(f => f.id === fileId ? { ...f, progress: 30 } : f)
        );
        
        // Upload para o Supabase Storage
        const { data, error } = await supabase.storage
          .from('attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        // Simular progresso após upload
        setUploadingFiles(prev => 
          prev.map(f => f.id === fileId ? { ...f, progress: 70 } : f)
        );
          
        if (error) throw error;
        
        // Obter URL pública do arquivo
        const { data: { publicUrl } } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);
        
        // Atualizar arquivo na lista com URL e progresso completo
        setUploadingFiles(prev => 
          prev.map(f => f.id === fileId ? { 
            ...f, 
            url: publicUrl, 
            progress: 100 
          } : f)
        );
        
      } catch (error) {
        console.error('Erro ao fazer upload:', error);
        
        // Atualizar arquivo na lista com erro
        setUploadingFiles(prev => 
          prev.map(f => f.id === fileId ? { 
            ...f, 
            error: 'Erro ao fazer upload', 
            progress: 0 
          } : f)
        );
        
        toast.error(`Erro ao fazer upload de ${file.name}`);
      }
    }
  };

  // Função para remover arquivo da lista de uploads
  const removeUploadingFile = (fileId: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Função para verificar se um ticket está finalizado
  const isTicketFinalized = (ticket: Ticket) => {
    return ticket.status === 'resolved' || ticket.status === 'closed';
  };

  // Função para abrir o chat de um ticket
  const openChat = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowChat(true);
    
    // Marcar mensagens como lidas quando abrir o chat
    if (user?.id && unreadMessages[ticket.id] > 0) {
      markMessagesAsRead(ticket.id);
    }
    
    // Configurar assinatura para digitação
    setupTypingSubscription();
  };

  // Função para fechar o chat
  const closeChat = () => {
    setShowChat(false);
    setSelectedTicket(null);
    setChatMessages([]);
    setNewMessage('');
    setUploadingFiles([]);
    
    // Cancelar assinaturas
    if (messageSubscription.current) {
      messageSubscription.current.unsubscribe();
    }
    if (typingSubscription.current) {
      typingSubscription.current.unsubscribe();
    }
  };

  // Funções para filtrar tickets
  const getFilteredTickets = () => {
    return tickets.filter(ticket => {
      // Filtro de pesquisa
      const matchesSearch = searchTerm === '' || 
        ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtro de status
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      
      // Filtro de prioridade
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
      
      // Filtro de atribuição
      const matchesAssigned = assignedFilter === 'all' || 
        (assignedFilter === 'assigned' && ticket.assignedTo) ||
        (assignedFilter === 'unassigned' && !ticket.assignedTo);
      
      // Filtro de usuário (para atribuição)
      const matchesUser = userFilter === 'all' || 
        (userFilter === 'mine' && ticket.assignedTo === user?.id) ||
        (userFilter !== 'mine' && userFilter !== 'all' && ticket.assignedTo === userFilter);
      
      return matchesSearch && matchesStatus && matchesPriority && matchesAssigned && matchesUser;
    });
  };

  // Organizar tickets por status para o quadro Kanban
  const getTicketsByStatus = () => {
    const filteredTickets = getFilteredTickets();
    
    return {
      open: filteredTickets.filter(ticket => ticket.status === 'open'),
      in_progress: filteredTickets.filter(ticket => ticket.status === 'in_progress'),
      resolved: filteredTickets.filter(ticket => ticket.status === 'resolved'),
      closed: filteredTickets.filter(ticket => ticket.status === 'closed')
    };
  };

  // Organizar tickets por usuário para o quadro de usuários
  const getTicketsByUser = () => {
    const filteredTickets = getFilteredTickets();
    const result: Record<string, Ticket[]> = {
      unassigned: filteredTickets.filter(ticket => !ticket.assignedTo)
    };
    
    // Adicionar tickets para cada usuário de suporte
    supportUsers.forEach(user => {
      result[user.id] = filteredTickets.filter(ticket => ticket.assignedTo === user.id);
    });
    
    return result;
  };

  // Funções para cores de status e prioridade
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Renderizar cartão de ticket
  const renderTicketCard = (ticket: Ticket) => {
    return (
      <SimpleTicketCard
        key={ticket.id}
        ticket={ticket}
        selectedTicketId={selectedTicket?.id}
        unreadCount={unreadMessages[ticket.id] || 0}
        onClick={() => openChat(ticket)}
        getPriorityColor={getPriorityColor}
        getStatusColor={getStatusColor}
        isTicketFinalized={isTicketFinalized}
      />
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho com filtros e botões */}
          <TicketHeader
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            assignedFilter={assignedFilter}
            setAssignedFilter={setAssignedFilter}
            userFilter={userFilter}
            setUserFilter={setUserFilter}
            view={view}
            setView={setView}
            // Remover esta linha:
            // showCreateForm={showCreateForm}
            setShowCreateForm={setShowCreateForm}
            supportUsers={supportUsers}
            user={user}
          />

      {/* Formulário de criação de ticket */}
      {showCreateForm && (
        <div className="mb-4">
          <TicketForm onSubmit={handleCreateTicket} onCancel={() => setShowCreateForm(false)} />
        </div>
      )}

      {/* Mensagem de erro */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-red-700">{error}</p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setError(null)} 
            className="ml-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Carregando */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D5B170]"></div>
          <span className="ml-3 text-slate-600">Carregando tickets...</span>
        </div>
      )}

      {/* Layout principal: lista de tickets + chat */}
      {!loading && (
        <div className="flex-1 flex">
          {/* Área principal (lista ou quadro) */}
          <div className={`flex-1 ${showChat ? 'hidden lg:block' : ''}`}>
            {/* Visualização em lista */}
            {view === 'list' && (
              <TicketList
                filteredTickets={getFilteredTickets()}
                tickets={tickets}
                renderTicketCard={renderTicketCard}
              />
            )}

            {/* Visualização em quadro Kanban */}
            {view === 'board' && (
              <TicketKanbanBoard
                ticketsByStatus={getTicketsByStatus()}
                renderTicketCard={renderTicketCard}
              />
            )}

            {/* Visualização por usuários */}
            {view === 'users' && (
              <TicketUserBoard
                ticketsByUser={getTicketsByUser()}
                supportUsers={supportUsers}
                renderTicketCard={renderTicketCard}
              />
            )}
          </div>

          {/* Painel de chat */}
          {showChat && selectedTicket && (
            <TicketChatPanel
              selectedTicket={selectedTicket}
              chatMessages={chatMessages}
              user={user}
              sending={sending}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              uploadingFiles={uploadingFiles}
              handleFileUpload={handleFileUpload}
              removeUploadingFile={removeUploadingFile}
              sendMessage={sendMessage}
              handleKeyPress={handleKeyPress}
              closeChat={closeChat}
              handleDeleteTicket={user?.role === 'admin' ? handleDeleteTicket : undefined}
              handleUpdateTicket={handleUpdateTicket}
              isTicketFinalized={isTicketFinalized}
              messagesEndRef={messagesEndRef}
              markMessagesAsRead={markMessagesAsRead}
              setShowImagePreview={setShowImagePreview}
              typingUsers={typingUsers}
              handleTyping={handleTyping}
            />
          )}
        </div>
      )}

      {/* Preview de imagem */}
      {showImagePreview && (
        <div 
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setShowImagePreview(null)}
        >
          <div className="max-w-4xl max-h-[90vh] relative">
            <img 
              src={showImagePreview} 
              alt="Preview" 
              className="max-w-full max-h-[90vh] object-contain"
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 bg-white/80"
              onClick={() => setShowImagePreview(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tickets;