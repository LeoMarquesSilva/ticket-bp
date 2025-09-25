import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Scale, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const { user, login, register, loading } = useAuth();
  const navigate = useNavigate();
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Register form state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      console.log('User is logged in, redirecting to home');
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setError('Por favor, preencha todos os campos');
      return;
    }

    setLoginLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('Attempting login with:', loginEmail);
      const result = await login(loginEmail, loginPassword);
      
      if (result.user) {
        console.log('Login successful, waiting for redirect...');
        setSuccess('Login realizado com sucesso! Redirecionando...');
        toast.success('Login realizado com sucesso!');
        
        // Give some time for the auth context to update
        setTimeout(() => {
          navigate('/');
        }, 1000);
      } else if (result.error) {
        console.error('Login error from result:', result.error);
        setError(result.error);
        toast.error(result.error);
      } else {
        // Se não houver erro específico, então é um problema de credenciais
        setError('Credenciais inválidas');
        toast.error('Credenciais inválidas');
      }
    } catch (error: any) {
      console.error('Login error from exception:', error);
      setError(error.message || 'Erro ao fazer login');
      toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName || !registerEmail || !registerPassword) {
      setError('Por favor, preencha todos os campos');
      return;
    }

    setRegisterLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('Attempting registration for:', registerEmail);
      const result = await register(registerEmail, registerPassword, registerName);

      if (result.user) {
        console.log('Registration successful');
        setSuccess('Cadastro realizado com sucesso! Redirecionando...');
        toast.success('Cadastro realizado com sucesso!');
        
        setTimeout(() => {
          navigate('/');
        }, 1000);
      } else {
        setError(result.error || 'Erro ao criar conta');
        toast.error(result.error || 'Erro ao criar conta');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(error.message || 'Erro ao criar conta');
      toast.error(error.message || 'Erro ao criar conta');
    } finally {
      setRegisterLoading(false);
    }
  };

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-[#D5B170] mx-auto mb-4" />
          <p className="text-lg text-slate-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-gradient-to-r from-[#101F2E] to-[#2a3f52] p-3 rounded-xl shadow-lg">
              <Scale className="h-8 w-8 text-[#D5B170]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-[#101F2E] mb-2">Sistema Legal</h1>
          <p className="text-slate-600">Gerenciamento de Tickets Jurídicos</p>
        </div>

        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl text-[#101F2E]">Acesso ao Sistema</CardTitle>
            <CardDescription>Entre com suas credenciais ou crie uma conta</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Cadastro</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="loginEmail">Email</Label>
                    <Input
                      id="loginEmail"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={loginLoading}
                      className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loginPassword">Senha</Label>
                    <Input
                      id="loginPassword"
                      type="password"
                      placeholder="Sua senha"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={loginLoading}
                      className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white shadow-lg"
                    disabled={loginLoading}
                  >
                    {loginLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="registerName">Nome Completo</Label>
                    <Input
                      id="registerName"
                      type="text"
                      placeholder="Seu nome completo"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      disabled={registerLoading}
                      className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registerEmail">Email</Label>
                    <Input
                      id="registerEmail"
                      type="email"
                      placeholder="seu@email.com"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      disabled={registerLoading}
                      className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registerPassword">Senha</Label>
                    <Input
                      id="registerPassword"
                      type="password"
                      placeholder="Sua senha (mínimo 6 caracteres)"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      disabled={registerLoading}
                      className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white shadow-lg"
                    disabled={registerLoading}
                  >
                    {registerLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      'Criar Conta'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-slate-600">
          <p>Sistema de Gerenciamento de Tickets Jurídicos</p>
          <p className="text-xs mt-1">Desenvolvido para BPP Law</p>
        </div>
      </div>
    </div>
  );
};

export default Login;