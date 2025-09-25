import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Scale, RefreshCw, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  
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

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0c1621] to-[#1a2a3a]">
        <div className="text-center">
          <RefreshCw className="h-10 w-10 animate-spin text-[#D5B170] mx-auto mb-4" />
          <p className="text-lg text-white/80">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#0c1621] to-[#1a2a3a] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-r from-[#D5B170] to-[#e9d4a7] p-4 rounded-2xl shadow-2xl">
              <Scale className="h-12 w-12 text-[#101F2E]" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Sistema de Tickets BP</h1>
          <p className="text-[#D5B170] text-lg font-medium">Gerenciamento de Tickets Jurídicos</p>
        </div>

        {error && (
          <Alert className="mb-6 border-red-300 bg-red-50/90 backdrop-blur-sm shadow-lg">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-300 bg-green-50/90 backdrop-blur-sm shadow-lg">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-md">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl text-[#101F2E] font-bold">Acesso ao Sistema</CardTitle>
            <CardDescription className="text-slate-600">Entre com suas credenciais para acessar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="loginEmail" className="text-[#101F2E] font-medium">Email</Label>
                <div className="relative">
                  <Input
                    id="loginEmail"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={loginLoading}
                    className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170] pl-10 py-6"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loginPassword" className="text-[#101F2E] font-medium">Senha</Label>
                <div className="relative">
                  <Input
                    id="loginPassword"
                    type="password"
                    placeholder="Sua senha"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loginLoading}
                    className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170] pl-10 py-6"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-[#D5B170] to-[#e9d4a7] hover:from-[#c4a05f] hover:to-[#d8c396] text-[#101F2E] font-bold py-6 text-lg shadow-lg"
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center pt-0">
            <p className="text-xs text-slate-500">
              Acesso restrito a usuários autorizados
            </p>
          </CardFooter>
        </Card>

        <div className="text-center mt-10 text-white/80">
          <p className="text-sm">Sistema de Gerenciamento de Tickets Jurídicos</p>
          <p className="text-xs mt-2 text-[#D5B170]">Desenvolvido pela Área de Operações Legais</p>
        </div>
      </div>
      
      {/* Elemento decorativo */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-[#D5B170]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-[#D5B170]/10 rounded-full blur-3xl"></div>
    </div>
  );
};

export default Login;