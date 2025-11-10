import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Scale, RefreshCw, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validLink, setValidLink] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);

  useEffect(() => {
    // Função para extrair parâmetros do hash da URL
    const getHashParams = (hash: string) => {
      const params: Record<string, string> = {};
      
      if (!hash || hash === '#') return params;
      
      // Remover o # inicial se existir
      const hashContent = hash.startsWith('#') ? hash.substring(1) : hash;
      
      // Dividir os parâmetros
      const paramPairs = hashContent.split('&');
      
      for (const pair of paramPairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[key] = decodeURIComponent(value);
        }
      }
      
      return params;
    };

    // Verificar se o link de redefinição é válido
    const checkResetLink = async () => {
      try {
        setCheckingLink(true);
        console.log('Checking reset password link validity');
        
        // Extrair o hash da URL
        const hash = location.hash;
        const searchParams = new URLSearchParams(location.search);
        console.log('URL hash:', hash);
        console.log('URL search params:', location.search);
        
        // Verificar se temos um token na URL (via query params)
        const token = searchParams.get('token');
        if (token) {
          console.log('Found token in URL query params');
          setValidLink(true);
          setCheckingLink(false);
          return;
        }
        
        // Verificar se o hash é "#/login" - este é o formato específico que o Supabase está enviando
        if (hash === '#/login') {
          console.log('Detected #/login hash, checking for active session');
          
          // Verificar se há uma sessão ativa
          const { data: sessionData } = await supabase.auth.getSession();
          console.log('Session data:', sessionData);
          
          if (sessionData?.session) {
            console.log('Valid session found, allowing reset');
            setValidLink(true);
            setCheckingLink(false);
            return;
          }
          
          // Se não há sessão, verificar o usuário atual
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            console.log('Authenticated user found, allowing reset');
            setValidLink(true);
            setCheckingLink(false);
            return;
          }
        }
        
        // Verificar se há erro no hash (como otp_expired)
        if (hash && hash.includes('error=')) {
          const errorParams = getHashParams(hash);
          console.log('Error params:', errorParams);
          
          if (errorParams.error_code === 'otp_expired') {
            setError('O link de redefinição de senha expirou. Por favor, solicite um novo link.');
          } else {
            setError(errorParams.error_description || 'Link de redefinição inválido.');
          }
          
          setValidLink(false);
          setCheckingLink(false);
          return;
        }
        
        if (!hash || hash === '#') {
          // Se não temos o hash com o token na URL, verificamos se há uma sessão ativa
          const { data, error } = await supabase.auth.getSession();
          
          if (error || !data.session) {
            console.error('No valid session or token:', error);
            setValidLink(false);
            setError('O link de redefinição de senha é inválido ou expirou.');
          } else {
            console.log('Valid session found');
            setValidLink(true);
          }
        } else {
          // Se temos um hash com token, vamos tentar processar
          try {
            // Extrair parâmetros do hash
            const params = getHashParams(hash);
            console.log('Hash params:', params);
            
            const accessToken = params.access_token;
            const refreshToken = params.refresh_token;
            const type = params.type;
            
            if (accessToken && type === 'recovery') {
              console.log('Found recovery token, setting session');
              
              // Definir a sessão com o token
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
              });
              
              if (error) {
                console.error('Error setting session:', error);
                setValidLink(false);
                setError('O token de redefinição de senha é inválido.');
              } else if (data.session) {
                console.log('Session set successfully');
                setValidLink(true);
                
                // Limpar o hash da URL para segurança
                window.history.replaceState({}, document.title, window.location.pathname);
              } else {
                setValidLink(false);
                setError('Não foi possível estabelecer uma sessão válida.');
              }
            } else {
              // Tentar verificar se há uma sessão ativa mesmo sem token na URL
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData?.session) {
                console.log('Valid session found without token, allowing reset');
                setValidLink(true);
                setCheckingLink(false);
                return;
              } else {
                console.error('Missing token or not recovery type:', { accessToken, type });
                setValidLink(false);
                setError('Link de redefinição inválido.');
              }
            }
          } catch (parseError) {
            console.error('Error parsing hash parameters:', parseError);
            setValidLink(false);
            setError('Erro ao processar o link de redefinição.');
          }
        }
      } catch (error) {
        console.error('Error checking reset link:', error);
        setValidLink(false);
        setError('Ocorreu um erro ao verificar o link de redefinição de senha.');
      } finally {
        setCheckingLink(false);
      }
    };

    checkResetLink();
  }, [location.hash, location.search]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      console.log('Updating password');
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        console.error('Reset password error:', error);
        setError(error.message);
        toast.error(error.message);
      } else {
        console.log('Password updated successfully');
        setSuccess('Senha redefinida com sucesso! Redirecionando para o login...');
        toast.success('Senha redefinida com sucesso!');
        
        // Redirecionar para a página de login após alguns segundos
        setTimeout(() => {
          // Fazer logout para limpar a sessão de recuperação
          supabase.auth.signOut().then(() => {
            navigate('/login');
          });
        }, 3000);
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      setError(error.message || 'Erro ao redefinir senha');
      toast.error(error.message || 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  // Mostrar tela de carregamento enquanto verifica o link
  if (checkingLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0c1621] to-[#1a2a3a]">
        <div className="text-center">
          <RefreshCw className="h-10 w-10 animate-spin text-[#D5B170] mx-auto mb-4" />
          <p className="text-lg text-white/80">Verificando link de redefinição...</p>
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
          <p className="text-[#D5B170] text-lg font-medium">Redefinição de Senha</p>
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

        {validLink ? (
          <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-md">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl text-[#101F2E] font-bold">Redefinir Senha</CardTitle>
              <CardDescription className="text-slate-600">
                Digite sua nova senha abaixo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[#101F2E] font-medium">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type="password"
                      placeholder="Digite sua nova senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170] pl-10 py-6"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-[#101F2E] font-medium">Confirmar Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirme sua nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
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
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Redefinir Senha'
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex justify-center pt-0">
              <Button 
                variant="link" 
                className="text-[#D5B170] hover:text-[#c4a05f] font-medium"
                onClick={() => navigate('/login')}
              >
                Voltar para o login
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-md">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl text-[#101F2E] font-bold">Link Inválido</CardTitle>
              <CardDescription className="text-slate-600">
                O link de redefinição de senha é inválido ou expirou.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 mb-4">
                Por favor, solicite um novo link de redefinição de senha na página de login.
              </p>
              <Button 
                onClick={() => navigate('/login')}
                className="bg-[#D5B170] hover:bg-[#c4a05f] text-[#101F2E] font-medium"
              >
                Voltar para o login
              </Button>
            </CardContent>
          </Card>
        )}

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

export default ResetPassword;