import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Lock, Mail, Calendar, Shield, Key } from 'lucide-react';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { toast } from 'sonner';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

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
