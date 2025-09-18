import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Search, Filter, MessageSquare, MessageCircle, Clock, CheckCircle, AlertCircle, User, Users, Bell, Send, X, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import TicketForm from '@/components/TicketForm';
import TicketCard from '@/components/TicketCard';
import { TicketService } from '@/services/ticketService';
import { supabase } from '@/lib/supabase';
import { Ticket, TicketStatus, TicketPriority } from '@/types';

const Tickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');

  const realtimeSubscriptionRef = useRef(null);
  const chatSubscriptionRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    if (user) {
      loadTickets();
      setupRealtimeSubscription();
    }

    return () => {
      if (realtimeSubscriptionRef.current) {
        realtimeSubscriptionRef.current();
      }
      if (chatSubscriptionRef.current) {
        chatSubscriptionRef.current();
      }
    };
  }, [user]);

  useEffect(() => {
    if (selectedTicket && selectedTicket.id) {
      loadChatMessages();
      setupChatSubscription();
    } else {
      setChatMessages([]);
      if (chatSubscriptionRef.current) {
        chatSubscriptionRef.current();
        chatSubscriptionRef.current = null;
      }
    }
  }, [selectedTicket]);

  const setupRealtimeSubscription = () => {
    if (!user) return;

    // Clean up existing subscription
    if (realtimeSubscriptionRef.current) {
      realtimeSubscriptionRef.current();
    }

    // Subscribe to ticket changes
    if (TicketService.subscribeToTickets) {
      realtimeSubscriptionRef.current = TicketService.subscribeToTickets(
        user.id,
        user.role,
        (payload) => {
          console.log('Real-time ticket update received:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newTicket = payload.new;
            if (newTicket && newTicket.id) {
              setTickets(prev => [newTicket, ...prev]);
              
              // Show notification for new tickets (for support/admin)
              if ((user.role === 'support' || user.role === 'admin') && payload.new.created_by !== user.id) {
                toast.info('Novo ticket criado!');
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedTicket = payload.new;
            if (updatedTicket && updatedTicket.id) {
              setTickets(prev => prev.map(ticket => 
                ticket && ticket.id === updatedTicket.id ? updatedTicket : ticket
              ).filter(ticket => ticket && ticket.id));
            }
          }
        }
      );
    }

    // Subscribe to all chat messages for notification
    const globalChatSubscription = supabase
      .channel('all-chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_c009c0e4f1_chat_messages',
        },
        (payload) => {
          console.log('New chat message received globally:', payload);
          
          // Only show notification if message is not from current user
          if (payload.new.user_id !== user.id) {
            const ticketId = payload.new.ticket_id;
            
            // Update unread count only if not currently viewing this ticket
            if (!selectedTicket || selectedTicket.id !== ticketId) {
              setUnreadMessages(prev => ({
                ...prev,
                [ticketId]: (prev[ticketId] || 0) + 1
              }));
              
              // Show toast notification
              toast.info(`Nova mensagem no ticket`);
            }
          }
        }
      )
      .subscribe();

    // Add global chat subscription to cleanup
    const originalCleanup = realtimeSubscriptionRef.current;
    realtimeSubscriptionRef.current = () => {
      if (originalCleanup) originalCleanup();
      globalChatSubscription.unsubscribe();
    };
  };

  const setupChatSubscription = () => {
    if (!selectedTicket || !selectedTicket.id) return;

    // Clean up existing chat subscription
    if (chatSubscriptionRef.current) {
      chatSubscriptionRef.current();
    }

    // Subscribe to messages for the selected ticket
    chatSubscriptionRef.current = TicketService.subscribeToTicketMessages(
      selectedTicket.id,
      (payload) => {
        console.log('New message received for selected ticket:', payload);
        if (payload.eventType === 'INSERT') {
          const newMsg = {
            id: payload.new.id,
            ticketId: payload.new.ticket_id,
            userId: payload.new.user_id,
            userName: payload.new.user_name,
            message: payload.new.message,
            createdAt: payload.new.created_at,
          };
          setChatMessages(prev => [...prev, newMsg]);
          
          // Show notification if message is from another user
          if (user && payload.new.user_id !== user.id) {
            toast.info(`Nova mensagem de ${payload.new.user_name}`);
          }
        }
      }
    );
  };

  const loadTickets = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('Loading tickets for user:', user.id, 'role:', user.role);
      
      const ticketsData = await TicketService.getTickets(user.id, user.role);
      console.log('Loaded tickets:', ticketsData);
      
      // Ensure ticketsData is an array and filter out any invalid tickets
      const validTickets = Array.isArray(ticketsData) 
        ? ticketsData.filter(ticket => ticket && ticket.id)
        : [];
      
      setTickets(validTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
      toast.error('Erro ao carregar tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const loadChatMessages = async () => {
    if (!selectedTicket || !selectedTicket.id) return;
    
    try {
      setLoadingMessages(true);
      const messages = await TicketService.getChatMessages(selectedTicket.id);
      setChatMessages(messages);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || sending || !selectedTicket?.id) return;

    try {
      setSending(true);
      await TicketService.sendChatMessage(
        selectedTicket.id,
        user.id,
        user.name,
        newMessage.trim()
      );
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCreateTicket = async (ticketData) => {
    if (!user) return;

    try {
      console.log('Creating ticket:', ticketData);
      const newTicket = await TicketService.createTicket({
        title: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority,
        category: ticketData.category,
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

  const handleUpdateTicket = async (ticketId, updates) => {
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

  const handleAssignTicket = async (ticketId, supportUserId) => {
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

  const openChat = (ticket) => {
    if (!ticket || !ticket.id) {
      toast.error('Ticket inválido');
      return;
    }
    
    setSelectedTicket(ticket);
    setShowChat(true);
    
    // Clear unread messages for this ticket
    setUnreadMessages(prev => ({
      ...prev,
      [ticket.id]: 0
    }));
  };

  const closeChat = () => {
    setShowChat(false);
    setSelectedTicket(null);
    setChatMessages([]);
  };

  // Filter tickets based on search and filters
  const filteredTickets = Array.isArray(tickets) ? tickets.filter(ticket => {
    if (!ticket || !ticket.id) return false;
    
    const matchesSearch = (ticket.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (ticket.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    
    let matchesAssigned = true;
    if (assignedFilter === 'assigned') {
      matchesAssigned = !!ticket.assignedTo;
    } else if (assignedFilter === 'unassigned') {
      matchesAssigned = !ticket.assignedTo;
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesAssigned;
  }) : [];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D5B170] mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Carregando tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4">
      {/* Left Sidebar - Tickets List */}
      <div className={`${showChat ? 'w-1/3' : 'w-full'} transition-all duration-300`}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-[#101F2E]">Tickets de Suporte</h1>
                <p className="text-slate-600 text-sm">
                  {user?.role === 'user' 
                    ? 'Suas solicitações de suporte jurídico'
                    : 'Todos os tickets do sistema'
                  }
                </p>
              </div>
              
              {user?.role === 'user' && (
                <Button
                  onClick={() => setShowCreateForm(true)}
                  size="sm"
                  className="bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Ticket
                </Button>
              )}
            </div>

            {/* Filters */}
            <Card className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar tickets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="resolved">Resolvido</SelectItem>
                    <SelectItem value="closed">Fechado</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                
                {(user?.role === 'support' || user?.role === 'admin') && (
                  <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Atribuição" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="assigned">Atribuídos</SelectItem>
                      <SelectItem value="unassigned">Não Atribuídos</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </Card>
          </div>

          {/* Tickets List */}
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {filteredTickets.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <MessageSquare className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-slate-500 text-center text-sm">
                      {tickets.length === 0 ? 'Nenhum ticket encontrado' : 'Nenhum ticket corresponde aos filtros'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredTickets.map((ticket) => (
                  <Card 
                    key={ticket.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTicket?.id === ticket.id 
                        ? 'border-[#D5B170] bg-[#D5B170]/5' 
                        : unreadMessages[ticket.id] > 0 
                          ? 'border-blue-300 bg-blue-50' 
                          : 'border-slate-200'
                    }`}
                    onClick={() => openChat(ticket)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-sm text-[#101F2E] line-clamp-1">
                          {ticket.title}
                        </h3>
                        {unreadMessages[ticket.id] > 0 && (
                          <Badge className="bg-red-500 text-white text-xs ml-2">
                            {unreadMessages[ticket.id]}
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                        {ticket.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-1 mb-2">
                        <Badge className={`${getStatusColor(ticket.status)} border text-xs`}>
                          {ticket.status === 'open' ? 'Aberto' : 
                           ticket.status === 'in_progress' ? 'Em Andamento' : 
                           ticket.status === 'resolved' ? 'Resolvido' : 'Fechado'}
                        </Badge>
                        <Badge className={`${getPriorityColor(ticket.priority)} border text-xs`}>
                          {ticket.priority === 'urgent' ? 'Urgente' : 
                           ticket.priority === 'high' ? 'Alta' : 
                           ticket.priority === 'medium' ? 'Média' : 'Baixa'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{ticket.createdByName}</span>
                        <span>{new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right Side - Chat */}
      {showChat && selectedTicket && (
        <div className="w-2/3 flex flex-col border-l border-slate-200">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeChat}
                  className="h-8 w-8 lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <MessageCircle className="h-5 w-5 text-[#D5B170]" />
                <div>
                  <h2 className="font-semibold text-[#101F2E]">
                    {selectedTicket.title}
                  </h2>
                  <p className="text-xs text-slate-600">
                    Ticket #{selectedTicket.id.slice(-8)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeChat}
                className="h-8 w-8 hidden lg:flex"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chat Messages */}
          <ScrollArea className="flex-1 p-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#D5B170]"></div>
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageCircle className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm">Nenhuma mensagem ainda</p>
                <p className="text-xs text-slate-400">
                  Seja o primeiro a enviar uma mensagem!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {chatMessages.map((message) => {
                  const isOwnMessage = user?.id === message.userId;
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                    >
                      <Avatar className="h-6 w-6 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-[#D5B170] text-white">
                          {message.userName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-700">
                            {message.userName}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatTime(message.createdAt)}
                          </span>
                        </div>
                        
                        <div
                          className={`px-3 py-2 rounded-2xl text-sm ${
                            isOwnMessage
                              ? 'bg-[#D5B170] text-white'
                              : 'bg-slate-100 text-slate-900'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">
                            {message.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Chat Input */}
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                disabled={sending}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="bg-[#D5B170] hover:bg-[#c4a05f] text-white px-4"
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[#101F2E]">Criar Novo Ticket</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                  className="h-8 w-8 p-0 hover:bg-slate-100"
                >
                  ×
                </Button>
              </div>
            </div>
            <div className="p-6">
              <TicketForm
                onSubmit={handleCreateTicket}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tickets;