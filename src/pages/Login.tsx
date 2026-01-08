import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertCircle, CheckCircle2, Lock, Mail, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const Login: React.FC = () => {
  const { user, login, loading, resetPassword } = useAuth();
  const navigate = useNavigate();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Reset password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Brand Gradient Definition
  const brandGradient = 'linear-gradient(90deg, rgba(246, 159, 25, 1) 0%, rgba(222, 85, 50, 1) 50%, rgba(189, 45, 41, 1) 100%)';

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

      if (result.error) {
        console.error('Login error from result:', result.error);
        setError(result.error);
        toast.error(result.error);
      } else {
        console.log('Login successful, waiting for redirect...');
        setSuccess('Login realizado com sucesso! Redirecionando...');
        toast.success('Login realizado com sucesso!');
        setTimeout(() => {
          navigate('/');
        }, 1000);
      }
    } catch (error: any) {
      console.error('Login error from exception:', error);
      setError(error.message || 'Erro ao fazer login');
      toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Por favor, informe seu e-mail');
      return;
    }

    setResetLoading(true);
    try {
      const result = await resetPassword(resetEmail);
      if (result.success) {
        toast.success('E-mail de redefinição de senha enviado com sucesso!');
        setResetDialogOpen(false);
        setResetEmail('');
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao solicitar redefinição de senha');
    } finally {
      setResetLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2C2D2F]">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-xl opacity-20 bg-[#F69F19]"></div>
            <RefreshCw className="h-10 w-10 animate-spin text-[#F69F19] mx-auto mb-4 relative z-10" />
          </div>
          <p className="text-lg text-slate-300 font-medium">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #2C2D2F 0%, #1A1B1D 100%)' }}
    >
      {/* Elementos de fundo decorativos (Glow Effects) */}
      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: brandGradient }}></div>
      
      {/* Orbs de luz ambiente */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#F69F19] opacity-[0.03] blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#BD2D29] opacity-[0.03] blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-[420px] relative z-10">
        
        {/* Logo Section (Logo Principal da Plataforma/Responsum) */}
        <div className="text-center mb-8 relative">
          <div className="flex items-center justify-center mb-6">
            <img 
              src="/assets/LOGO-S-FUNDO.png" 
              alt="RESPONSUM" 
              className="h-32 w-auto object-contain drop-shadow-2xl" 
            />
          </div>
        </div>

        {error && (
          <Alert className="mb-6 border-[#BD2D29]/30 bg-[#BD2D29]/10 backdrop-blur-sm shadow-lg">
            <AlertCircle className="h-4 w-4 text-[#BD2D29]" />
            <AlertDescription className="text-[#BD2D29] font-medium">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-500/30 bg-green-500/10 backdrop-blur-sm shadow-lg">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-500 font-medium">{success}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-xl overflow-hidden rounded-2xl ring-1 ring-white/10">
          {/* Barra de gradiente no topo do card */}
          <div className="h-[3px] w-full" style={{ background: brandGradient }}></div>
          
          <CardHeader className="text-center pb-2 pt-8">
            {/* ALTERAÇÃO AQUI: Trocado "Acesso ao Sistema" pela Logo BP */}
            <div className="flex justify-center mb-4">
              <img 
                src="/assets/logo-bp-azul.png" 
                alt="Logo BP" 
                className="h-16 w-auto object-contain" 
              />
            </div>
          </CardHeader>
          
          <CardContent className="px-8 pb-8 pt-4">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="loginEmail" className="text-[#2C2D2F] font-medium text-sm">Email Corporativo</Label>
                <div className="relative group">
                  <Input
                    id="loginEmail"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={loginLoading}
                    className="bg-slate-50 border-slate-200 focus:border-[#F69F19] focus:ring-[#F69F19]/20 pl-10 py-6 transition-all duration-300 group-hover:bg-white"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#F69F19] transition-colors">
                    <Mail className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="loginPassword" className="text-[#2C2D2F] font-medium text-sm">Senha</Label>
                </div>
                <div className="relative group">
                  <Input
                    id="loginPassword"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={loginLoading}
                    className="bg-slate-50 border-slate-200 focus:border-[#F69F19] focus:ring-[#F69F19]/20 pl-10 py-6 transition-all duration-300 group-hover:bg-white"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#F69F19] transition-colors">
                    <Lock className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full font-bold py-6 text-md shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all duration-300 border-0 text-white mt-2"
                style={{ background: brandGradient }}
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <span className="flex items-center">
                    Entrar na Plataforma
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="flex justify-center pb-6 pt-0 bg-slate-50/50 border-t border-slate-100">
            <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="link" className="text-[#DE5532] hover:text-[#BD2D29] font-medium text-sm mt-4">
                  Esqueceu sua senha?
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden gap-0 border-0 shadow-2xl">
                <div className="h-[3px] w-full" style={{ background: brandGradient }}></div>
                <div className="p-6">
                  <DialogHeader className="mb-4">
                    <DialogTitle className="text-[#2C2D2F] font-bold text-xl">Recuperação de Senha</DialogTitle>
                    <DialogDescription>
                      Digite seu e-mail corporativo para receber as instruções de redefinição.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="resetEmail" className="text-[#2C2D2F] font-medium">
                        Email
                      </Label>
                      <div className="relative">
                        <Input
                          id="resetEmail"
                          type="email"
                          placeholder="seu@email.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          disabled={resetLoading}
                          className="border-slate-300 focus:border-[#F69F19] focus:ring-[#F69F19]/20 pl-10"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <Mail className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="mt-6">
                      <Button
                        type="submit"
                        className="w-full text-white font-medium"
                        style={{ background: brandGradient }}
                        disabled={resetLoading}
                      >
                        {resetLoading ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          'Enviar link de recuperação'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </div>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>

        <div className="text-center mt-8 space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-medium opacity-60">
            Sistema de Help Desk Jurídico
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Lock className="h-3 w-3" />
            <span>Ambiente Seguro & Criptografado</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
