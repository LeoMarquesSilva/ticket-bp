import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, Mail, Lock, User, Building } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const Register: React.FC = () => {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user' as 'user' | 'support' | 'admin',
  });
  const [error, setError] = useState('');

  const handleQuickRegister = async (userData: { name: string; email: string; role: 'user' | 'support' | 'admin' }) => {
    try {
      const { user, error } = await register(
        userData.email,
        '123456', // Senha padrão para teste
        userData.name
      );
      
      if (user && !error) {
        toast.success(`Logado como ${userData.name}`);
        navigate('/');
      } else {
        toast.error(error || 'Erro ao fazer login rápido');
      }
    } catch (error) {
      console.error('Quick register error:', error);
      toast.error('Erro ao fazer login rápido');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError('Todos os campos são obrigatórios');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      const { user, error } = await register(
        formData.email,
        formData.password,
        formData.name
      );

      if (user && !error) {
        toast.success('Conta criada com sucesso!');
        navigate('/');
      } else {
        setError(error || 'Erro ao criar conta. Tente novamente.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Erro ao criar conta. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-[#101F2E] to-[#2a3f52] rounded-full flex items-center justify-center mb-4">
              <img 
                src="/assets/PNGLOGO.png" 
                alt="Logo" 
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                }}
              />
            <Building className="w-8 h-8 text-white" style={{ display: 'none' }} />
          </div>
          <h1 className="text-2xl font-bold text-[#101F2E]">Criar Conta</h1>
          <p className="text-slate-600">Sistema de Tickets Jurídicos</p>
        </div>

        {/* Quick Register Buttons */}
        <Card className="border-[#D5B170]/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-center text-slate-700">Login Rápido (Para Teste)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start border-blue-200 hover:bg-blue-50"
              onClick={() => handleQuickRegister({ name: 'João Silva', email: 'juridico@empresa.com', role: 'user' })}
            >
              <User className="h-4 w-4 mr-2 text-blue-600" />
              Entrar como Jurídico
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-purple-200 hover:bg-purple-50"
              onClick={() => handleQuickRegister({ name: 'Maria Santos', email: 'operacoes@empresa.com', role: 'support' })}
            >
              <User className="h-4 w-4 mr-2 text-purple-600" />
              Entrar como Op. Legais
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-green-200 hover:bg-green-50"
              onClick={() => handleQuickRegister({ name: 'Carlos Admin', email: 'gestor@empresa.com', role: 'admin' })}
            >
              <User className="h-4 w-4 mr-2 text-green-600" />
              Entrar como Gestor
            </Button>
          </CardContent>
        </Card>

        {/* Registration Form */}
        <Card className="border-[#D5B170]/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#D5B170]" />
              Cadastro Completo
            </CardTitle>
            <CardDescription>
              Preencha os dados para criar sua conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10 border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10 border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Função</Label>
                <Select value={formData.role} onValueChange={(value: 'user' | 'support' | 'admin') => setFormData({ ...formData, role: value })}>
                  <SelectTrigger className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]">
                    <SelectValue placeholder="Selecione sua função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Jurídico (Usuário)</SelectItem>
                    <SelectItem value="support">Operações Legais (Suporte)</SelectItem>
                    <SelectItem value="admin">Gestor (Administrador)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10 border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirme sua senha"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="pl-10 border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white"
                disabled={loading}
              >
                {loading ? 'Criando conta...' : 'Criar Conta'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-sm text-slate-600">
                Já tem uma conta?{' '}
                <Link to="/login" className="text-[#D5B170] hover:underline font-medium">
                  Fazer login
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;