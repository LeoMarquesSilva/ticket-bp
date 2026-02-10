import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { User, Lock, Mail, Calendar, Shield, Key, LayoutGrid, List, Users, ImagePlus, RefreshCw, Bell, BellOff } from 'lucide-react';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import UserAvatar from '@/components/UserAvatar';
import AvatarCropModal from '@/components/AvatarCropModal';
import { UserService } from '@/services/userService';
import { AvatarService } from '@/services/avatarService';
import { toast } from 'sonner';
import {
  isPushSupported,
  getNotificationPermission,
  registerServiceWorker,
  subscribeUserToPush,
  unsubscribeUserFromPush,
} from '@/services/pushService';
import { supabase, TABLES } from '@/lib/supabase';

const Profile: React.FC = () => {
  const { user, refreshUserProfile } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [viewPreference, setViewPreference] = useState<'list' | 'board' | 'users'>('list');
  const [savingPreference, setSavingPreference] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageFile, setCropImageFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  
  // Carregar preferência e avatar atual do usuário
  useEffect(() => {
    if (user?.ticketViewPreference) {
      setViewPreference(user.ticketViewPreference);
    }
    if (user?.avatarUrl !== undefined) {
      setAvatarUrlInput(user.avatarUrl ?? '');
    }
  }, [user?.ticketViewPreference, user?.avatarUrl]);

  // Verificar se o usuário já tem inscrição de push
  useEffect(() => {
    if (!user?.id || !isPushSupported()) return;
    const check = async () => {
      const { data } = await supabase
        .from(TABLES.PUSH_SUBSCRIPTIONS)
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      setPushEnabled(!!data);
    };
    check();
  }, [user?.id]);
  
  // Salvar preferência de visualização
  const handleViewPreferenceChange = async (newPreference: 'list' | 'board' | 'users') => {
    if (!user?.id) return;
    
    setSavingPreference(true);
    try {
      const success = await UserService.updateTicketViewPreference(user.id, newPreference);
      if (success) {
        setViewPreference(newPreference);
        await refreshUserProfile(); // Atualizar o contexto do usuário
        toast.success('Preferência de visualização salva com sucesso!');
      } else {
        toast.error('Erro ao salvar preferência. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao salvar preferência:', error);
      toast.error('Erro ao salvar preferência. Tente novamente.');
    } finally {
      setSavingPreference(false);
    }
  };

  // Gradiente oficial da marca Responsum
  const brandGradient = 'linear-gradient(90deg, rgba(246, 159, 25, 1) 0%, rgba(222, 85, 50, 1) 50%, rgba(189, 45, 41, 1) 100%)';

  const getRoleLabel = (role: string) => {
    const roleMap = {
      'admin': 'Gestor Op. Legais',
      'support': 'Op. Legais',
      'lawyer': 'Advogado',
      'user': 'Jurídico'
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  const getRoleColor = (role: string) => {
    const colorMap = {
      'admin': 'bg-[#F69F19]/10 text-[#F69F19] border-[#F69F19]/20',
      'support': 'bg-[#DE5532]/10 text-[#DE5532] border-[#DE5532]/20',
      'lawyer': 'bg-[#2C2D2F]/10 text-[#2C2D2F] border-[#2C2D2F]/20',
      'user': 'bg-slate-100 text-slate-600 border-slate-200'
    };
    return colorMap[role as keyof typeof colorMap] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getDepartmentColor = (department?: string) => {
    switch (department?.toLowerCase()) {
      case 'contencioso':
        return 'bg-white text-[#2C2D2F] border-l-4 border-l-[#BD2D29] border-y border-r border-slate-200';
      case 'consultivo':
        return 'bg-white text-[#2C2D2F] border-l-4 border-l-[#F69F19] border-y border-r border-slate-200';
      case 'trabalhista':
        return 'bg-white text-[#2C2D2F] border-l-4 border-l-[#DE5532] border-y border-r border-slate-200';
      case 'tributário':
        return 'bg-white text-[#2C2D2F] border-l-4 border-l-[#2C2D2F] border-y border-r border-slate-200';
      case 'contratos':
        return 'bg-white text-[#2C2D2F] border-l-4 border-l-slate-400 border-y border-r border-slate-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Data não disponível';
      }
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Data não disponível';
    }
  };

  const handlePasswordChangeSuccess = () => {
    setShowPasswordModal(false);
    toast.success('Senha alterada com sucesso!');
  };

  const handleTogglePush = async (enable: boolean) => {
    if (!user?.id) return;
    setPushLoading(true);
    try {
      if (enable) {
        await registerServiceWorker();
        const result = await subscribeUserToPush(user.id);
        if (result.ok) {
          setPushEnabled(true);
          toast.success('Notificações push ativadas. Você receberá avisos mesmo com a aba fechada.');
        } else {
          toast.error(result.error || 'Não foi possível ativar.');
        }
      } else {
        const result = await unsubscribeUserFromPush(user.id);
        if (result.ok) {
          setPushEnabled(false);
          toast.success('Notificações push desativadas.');
        } else {
          toast.error(result.error || 'Não foi possível desativar.');
        }
      }
    } finally {
      setPushLoading(false);
    }
  };

  const handleSaveAvatarUrl = async () => {
    if (!user?.id) return;
    const url = avatarUrlInput.trim() || undefined;
    try {
      await UserService.updateUser(user.id, { avatarUrl: url });
      await refreshUserProfile();
      toast.success('Foto atualizada!');
    } catch (e) {
      toast.error('Erro ao atualizar foto.');
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user?.id) return;
    setAvatarUploading(true);
    try {
      const { url } = await AvatarService.uploadAvatar(user.id, file);
      await UserService.updateUser(user.id, { avatarUrl: url });
      setAvatarUrlInput(url);
      await refreshUserProfile();
      toast.success('Foto enviada!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar foto.');
    } finally {
      setAvatarUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F6F6F6]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F69F19] mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium font-sans">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F6] p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Estilizado Responsum */}
        <div 
          className="relative py-8 px-8 rounded-xl overflow-hidden shadow-lg border border-[#F69F19]/10"
          style={{ 
            background: `linear-gradient(135deg, #2C2D2F 0%, #1A1B1D 100%)`
          }}
        >
          {/* Barra superior com o Gradiente Oficial */}
          <div 
            className="absolute top-0 left-0 w-full h-[4px]" 
            style={{ background: brandGradient }}
          ></div>
          
          {/* Elementos decorativos de fundo */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-[#F69F19]/5 blur-3xl"></div>
          <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-[#DE5532]/5 blur-2xl"></div>

          <div className="relative z-10">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              Meu Perfil
              {/* Ponto decorativo com gradiente */}
              <span 
                className="h-2 w-2 rounded-full"
                style={{ background: brandGradient }}
              ></span>
            </h1>
            <p className="text-slate-300 max-w-xl text-sm leading-relaxed font-medium">
              Gerencie suas informações pessoais, visualize suas atribuições e configure a segurança da sua conta no ambiente Responsum.
            </p>
          </div>
        </div>

        {/* Informações do Usuário */}
        <Card className="border-[#F69F19]/10 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-[#2C2D2F]">
              <div className="p-2 rounded-lg bg-[#F69F19]/10">
                <User className="h-5 w-5 text-[#F69F19]" />
              </div>
              Informações Pessoais
            </CardTitle>
            <CardDescription>
              Dados de identificação e acesso no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Foto (Avatar) */}
            <div className="space-y-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <User className="h-3 w-3" />
                Sua Foto
              </label>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  size="lg"
                  className="shrink-0"
                />
                <div className="flex-1 w-full space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="URL da imagem (ex: WordPress)"
                      value={avatarUrlInput}
                      onChange={(e) => setAvatarUrlInput(e.target.value)}
                      className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F69F19]/50"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveAvatarUrl}
                      className="bg-[#F69F19] hover:bg-[#e08e12] text-white"
                    >
                      Salvar URL
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      title="Enviar arquivo"
                    >
                      {avatarUploading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                    </Button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCropImageFile(file);
                          setCropModalOpen(true);
                        }
                        e.target.value = '';
                      }}
                    />
                    <AvatarCropModal
                      open={cropModalOpen}
                      onOpenChange={(open) => {
                        setCropModalOpen(open);
                        if (!open) setCropImageFile(null);
                      }}
                      imageFile={cropImageFile}
                      onCropComplete={(croppedFile) => {
                        handleAvatarUpload(croppedFile);
                        setCropImageFile(null);
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Cole o link (WordPress) e clique em Salvar URL, ou envie uma imagem (máx. 20 MB)
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Nome e Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <User className="h-3 w-3" />
                  Nome Completo
                </label>
                <div className="p-3 bg-[#F6F6F6] rounded-lg border border-slate-200">
                  <p className="font-medium text-[#2C2D2F]">{user.name}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  Email Corporativo
                </label>
                <div className="p-3 bg-[#F6F6F6] rounded-lg border border-slate-200">
                  <p className="text-[#2C2D2F]">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Função e Departamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Shield className="h-3 w-3" />
                  Função / Permissão
                </label>
                <div className="p-3 bg-[#F6F6F6] rounded-lg border border-slate-200">
                  <Badge variant="outline" className={`font-medium px-3 py-1 ${getRoleColor(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </Badge>
                </div>
              </div>

              {user.department && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Shield className="h-3 w-3" />
                    Departamento
                  </label>
                  <div className="p-3 bg-[#F6F6F6] rounded-lg border border-slate-200">
                    <Badge variant="outline" className={`font-medium px-3 py-1 ${getDepartmentColor(user.department)}`}>
                      {user.department}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {/* Data de cadastro se disponível */}
            {user.createdAt && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  Membro desde
                </label>
                <div className="p-3 bg-[#F6F6F6] rounded-lg border border-slate-200">
                  <p className="text-[#2C2D2F]">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card className="border-[#F69F19]/10 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-[#2C2D2F]">
              <div className="p-2 rounded-lg bg-[#F69F19]/10">
                <Lock className="h-5 w-5 text-[#F69F19]" />
              </div>
              Segurança
            </CardTitle>
            <CardDescription>
              Gerencie suas credenciais de acesso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Última alteração de senha */}
            {user.passwordChangedAt && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Última alteração de senha
                </label>
                <div className="p-3 bg-[#F6F6F6] rounded-lg border border-slate-200">
                  <p className="text-[#2C2D2F]">{formatDate(user.passwordChangedAt)}</p>
                </div>
              </div>
            )}

            <Separator className="bg-slate-100" />

            {/* Alterar Senha - Box estilizado */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-[#F69F19]/5 rounded-xl border border-[#F69F19]/20 gap-4">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="p-3 bg-white rounded-full shadow-sm border border-[#F69F19]/10">
                  <Key className="h-5 w-5 text-[#DE5532]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#2C2D2F]">Alterar Senha</h3>
                  <p className="text-sm text-slate-600">
                    Mantenha sua conta segura atualizando periodicamente
                  </p>
                </div>
              </div>
              
              <Button
                onClick={() => setShowPasswordModal(true)}
                style={{ background: brandGradient }}
                className="w-full sm:w-auto text-white font-medium shadow-md hover:opacity-90 transition-opacity border-0"
              >
                <Lock className="h-4 w-4 mr-2" />
                Alterar Senha
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notificações push */}
        {isPushSupported() && (
          <Card className="border-[#F69F19]/10 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-[#2C2D2F]">
                <div className="p-2 rounded-lg bg-[#F69F19]/10">
                  <Bell className="h-5 w-5 text-[#F69F19]" />
                </div>
                Notificações push
              </CardTitle>
              <CardDescription>
                Receba avisos de novas mensagens e tickets mesmo com a aba ou o navegador fechados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <p className="text-sm text-slate-600">
                {getNotificationPermission() === 'denied'
                  ? 'As notificações estão bloqueadas neste navegador. Libere nas configurações do site para ativar.'
                  : pushEnabled
                    ? 'Ativado: você receberá notificações quando houver nova mensagem ou ticket.'
                    : 'Ative para receber notificações mesmo com a aba fechada.'}
              </p>
              {getNotificationPermission() !== 'denied' && (
                <Button
                  type="button"
                  variant={pushEnabled ? 'outline' : 'default'}
                  disabled={pushLoading}
                  onClick={() => handleTogglePush(!pushEnabled)}
                  className={!pushEnabled ? 'bg-[#F69F19] hover:bg-[#e08e12] text-white' : ''}
                >
                  {pushLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : pushEnabled ? (
                    <>
                      <BellOff className="h-4 w-4 mr-2" />
                      Desativar notificações push
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4 mr-2" />
                      Ativar notificações push
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preferências de Visualização */}
        <Card className="border-[#F69F19]/10 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-[#2C2D2F]">
              <div className="p-2 rounded-lg bg-[#F69F19]/10">
                <LayoutGrid className="h-5 w-5 text-[#F69F19]" />
              </div>
              Preferências de Visualização
            </CardTitle>
            <CardDescription>
              Escolha como você prefere visualizar os tickets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-4">
              <Label className="text-sm font-medium text-[#2C2D2F]">
                Visualização padrão de tickets
              </Label>
              <RadioGroup
                value={viewPreference}
                onValueChange={(value) => handleViewPreferenceChange(value as 'list' | 'board' | 'users')}
                disabled={savingPreference}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <RadioGroupItem value="list" id="list" className="border-[#F69F19] text-[#F69F19]" />
                  <Label htmlFor="list" className="flex-1 cursor-pointer flex items-center gap-3">
                    <List className="h-5 w-5 text-[#F69F19]" />
                    <div>
                      <div className="font-medium text-[#2C2D2F]">Lista</div>
                      <div className="text-xs text-slate-500">Visualização em lista de cards</div>
                    </div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <RadioGroupItem value="board" id="board" className="border-[#F69F19] text-[#F69F19]" />
                  <Label htmlFor="board" className="flex-1 cursor-pointer flex items-center gap-3">
                    <LayoutGrid className="h-5 w-5 text-[#F69F19]" />
                    <div>
                      <div className="font-medium text-[#2C2D2F]">Quadro (Kanban)</div>
                      <div className="text-xs text-slate-500">Organização por status em colunas</div>
                    </div>
                  </Label>
                </div>
                
                {(user?.role === 'admin' || user?.role === 'support' || user?.role === 'lawyer') && (
                  <div className="flex items-center space-x-3 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    <RadioGroupItem value="users" id="users" className="border-[#F69F19] text-[#F69F19]" />
                    <Label htmlFor="users" className="flex-1 cursor-pointer flex items-center gap-3">
                      <Users className="h-5 w-5 text-[#F69F19]" />
                      <div>
                        <div className="font-medium text-[#2C2D2F]">Por Usuário</div>
                        <div className="text-xs text-slate-500">Organização por usuário atribuído</div>
                      </div>
                    </Label>
                  </div>
                )}
              </RadioGroup>
              
              {savingPreference && (
                <div className="text-sm text-slate-500 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#F69F19]"></div>
                  Salvando preferência...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Alteração de Senha */}
      <ChangePasswordModal
        open={showPasswordModal}
        isFirstLogin={false}
        onSuccess={handlePasswordChangeSuccess}
        onCancel={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

export default Profile;
