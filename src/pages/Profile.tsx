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
      'admin': 'bg-red-100 text-red-800 border-red-200',
      'support': 'bg-blue-100 text-blue-800 border-blue-200',
      'lawyer': 'bg-purple-100 text-purple-800 border-purple-200',
      'user': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colorMap[role as keyof typeof colorMap] || 'bg-gray-100 text-gray-800 border-gray-200';
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

  const getDepartmentColor = (department?: string) => {
    switch (department?.toLowerCase()) {
      case 'contencioso':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'consultivo':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'trabalhista':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'tributário':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'contratos':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const handlePasswordChangeSuccess = () => {
    setShowPasswordModal(false);
    toast.success('Senha alterada com sucesso!');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D5B170] mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#101F2E]">Meu Perfil</h1>
            <p className="text-slate-600 mt-1">Gerencie suas informações pessoais e configurações</p>
          </div>
        </div>

        {/* Informações do Usuário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-[#D5B170]" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>
              Suas informações básicas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nome e Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nome Completo
                </label>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="font-medium text-[#101F2E]">{user.name}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </label>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-[#101F2E]">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Função e Departamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Função
                </label>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <Badge className={getRoleColor(user.role)}>
                    {getRoleLabel(user.role)}
                  </Badge>
                </div>
              </div>

              {user.department && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Departamento
                  </label>
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <Badge variant="outline" className={getDepartmentColor(user.department)}>
                      {user.department}
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {/* Data de cadastro se disponível */}
            {user.createdAt && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Membro desde
                </label>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-[#101F2E]">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#D5B170]" />
              Segurança
            </CardTitle>
            <CardDescription>
              Gerencie suas configurações de segurança
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Última alteração de senha */}
            {user.passwordChangedAt && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Última alteração de senha
                </label>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-[#101F2E]">{formatDate(user.passwordChangedAt)}</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Alterar Senha */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Key className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-[#101F2E]">Alterar Senha</h3>
                  <p className="text-sm text-slate-600">
                    Mantenha sua conta segura alterando sua senha regularmente
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowPasswordModal(true)}
                className="bg-[#D5B170] hover:bg-[#c4a05f] text-[#101F2E] font-medium"
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