import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, RefreshCw, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { passwordService } from '@/services/passwordService';
import { toast } from 'sonner';

// Constantes do Supabase para uso na API REST
const SUPABASE_URL = 'https://jhgbrbarfpvgdaaznldj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoZ2JyYmFyZnB2Z2RhYXpubGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDU4MDMsImV4cCI6MjA3MzYyMTgwM30.QaaMs2MNbD05Lpm_H1qP25FJT3pT_mmPGvhZ1wsJNcA';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    
    const processResetLink = async () => {
      try {
        console.log('🔍 === PROCESSANDO LINK DE RESET ===');
        console.log('📍 URL atual:', window.location.href);
        
        // Extrair parâmetros da URL (query string e hash)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        // Buscar todos os tipos de tokens/códigos possíveis
        const token = urlParams.get('token') || hashParams.get('token');
        const tokenHash = urlParams.get('token_hash') || hashParams.get('token_hash');
        const code = urlParams.get('code') || hashParams.get('code');
        const accessToken = urlParams.get('access_token') || hashParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token') || hashParams.get('refresh_token');
        const type = urlParams.get('type') || hashParams.get('type');
        
        console.log('🔑 Parâmetros extraídos:', {
          hasToken: !!token,
          hasTokenHash: !!tokenHash,
          hasCode: !!code,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type: type,
          tokenPreview: token ? `${token.substring(0, 20)}...` : null,
          tokenHashPreview: tokenHash ? `${tokenHash.substring(0, 20)}...` : null,
          codePreview: code ? `${code.substring(0, 20)}...` : null
        });

        // Método 1: Se temos access_token e refresh_token diretos (formato mais comum do Supabase)
        if (accessToken && refreshToken) {
          console.log('🔄 Método 1: Usando tokens diretos do hash...');
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (!error && data.session && data.user) {
              console.log('✅ Sucesso com tokens diretos!');
              setSessionValid(true);
              setValidatingToken(false);
              // Limpar hash da URL para não expor tokens
              window.history.replaceState({}, document.title, '/reset-password');
              toast.success('Link válido! Você pode redefinir sua senha agora.');
              return;
            } else {
              console.log('❌ Erro ao definir sessão:', error?.message);
            }
          } catch (e: any) {
            console.log('❌ Falha método 1:', e?.message || e);
          }
        }

        // Método 2: Se temos token_hash (formato correto do template) - usar verifyOtp com type recovery
        // Para reset de senha, o Supabase envia um token_hash que deve ser usado com verifyOtp
        if (tokenHash && type === 'recovery') {
          console.log('🔄 Método 2: Usando token_hash com verifyOtp recovery...');
          try {
            // Para reset de senha, usar verifyOtp com token_hash
            const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'recovery'
            });
            
            if (!otpError && otpData.session && otpData.user) {
              console.log('✅ Sucesso com verifyOtp recovery!');
              setSessionValid(true);
              setValidatingToken(false);
              window.history.replaceState({}, document.title, '/reset-password');
              toast.success('Link válido! Você pode redefinir sua senha agora.');
              return;
            } else {
              console.log('❌ Erro ao verificar OTP recovery:', otpError?.message);
              
              // Se verifyOtp falhar, o código pode ser um código PKCE que precisa de tratamento especial
              // Tentar usar a API REST com o endpoint correto para recovery
              console.log('🔄 Tentando via API REST (recovery endpoint)...');
              try {
                // Tentar o endpoint de verify com recovery
                const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                  },
                  body: JSON.stringify({
                    token_hash: code,
                    type: 'recovery'
                  }),
                });
                
                const result = await response.json();
                console.log('📨 Resposta da API REST:', { ok: response.ok, result });
                
                if (response.ok && result.access_token) {
                  console.log('✅ Sucesso via API REST!');
                  // Criar sessão com os tokens recebidos
                  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                    access_token: result.access_token,
                    refresh_token: result.refresh_token,
                  });
                  
                  if (!sessionError && sessionData.session && sessionData.user) {
                    setSessionValid(true);
                    setValidatingToken(false);
                    window.history.replaceState({}, document.title, '/reset-password');
                    toast.success('Link válido! Você pode redefinir sua senha agora.');
                    return;
                  } else {
                    console.log('❌ Erro ao criar sessão:', sessionError?.message);
                  }
                } else {
                  console.log('❌ Erro na API REST:', result.error || result);
                }
              } catch (apiE: any) {
                console.log('❌ Falha API REST:', apiE?.message || apiE);
              }
            }
          } catch (e: any) {
            console.log('❌ Falha método 2:', e?.message || e);
          }
        }

        // Método 2.5: Se temos um código (code) - tentar como token_hash (formato alternativo)
        if (code && !tokenHash) {
          console.log('🔄 Método 2.5: Tentando código (code) como token_hash...');
          try {
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: code,
              type: 'recovery'
            });
            
            if (!error && data.session && data.user) {
              console.log('✅ Sucesso com código como token_hash!');
              setSessionValid(true);
              setValidatingToken(false);
              window.history.replaceState({}, document.title, '/reset-password');
              toast.success('Link válido! Você pode redefinir sua senha agora.');
              return;
            } else {
              console.log('❌ Erro ao verificar código:', error?.message);
            }
          } catch (e: any) {
            console.log('❌ Falha método 2.5:', e?.message || e);
          }
        }

        // Método 2.6: Se temos um token de recovery direto (formato alternativo)
        if (token && type === 'recovery') {
          console.log('🔄 Método 2.6: Usando token de recovery...');
          try {
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: 'recovery'
            });
            
            if (!error && data.session && data.user) {
              console.log('✅ Sucesso com token de recovery!');
              setSessionValid(true);
              setValidatingToken(false);
              window.history.replaceState({}, document.title, '/reset-password');
              toast.success('Link válido! Você pode redefinir sua senha agora.');
              return;
            } else {
              console.log('❌ Erro ao verificar OTP:', error?.message);
            }
          } catch (e: any) {
            console.log('❌ Falha método 2.6:', e?.message || e);
          }
        }

        // Método 3: Listener para mudanças de autenticação (o Supabase pode processar automaticamente)
        console.log('🔄 Método 3: Configurando listener de autenticação...');
        
        const { data: authData } = supabase.auth.onAuthStateChange((event, session) => {
          console.log('🔔 Evento de autenticação:', event, {
            hasSession: !!session,
            hasUser: !!session?.user,
            userEmail: session?.user?.email
          });
          
          if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
            queueMicrotask(() => {
              console.log('✅ Sessão criada via evento de autenticação!');
              setSessionValid(true);
              setValidatingToken(false);
              window.history.replaceState({}, document.title, '/reset-password');
              toast.success('Link válido! Você pode redefinir sua senha agora.');

              // Remover listener após sucesso
              if (authListener) {
                authListener.subscription.unsubscribe();
                authListener = null;
              }
            });
          }
        });
        
        authListener = authData;

        // Método 4: Aguardar processamento automático do Supabase (com detectSessionInUrl habilitado)
        console.log('🔄 Método 4: Aguardando processamento automático...');
        
        // Aguardar para o Supabase processar a sessão automaticamente
        for (let i = 0; i < 15; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (i % 3 === 0) { // Log a cada 1.5 segundos
            console.log(`📊 Verificação ${i + 1}/15:`, {
              hasSession: !!session,
              hasUser: !!session?.user,
              userEmail: session?.user?.email,
              error: sessionError?.message || 'nenhum'
            });
          }
          
          if (session && session.user && !sessionError) {
            console.log('✅ Sessão encontrada após aguardar!');
            setSessionValid(true);
            setValidatingToken(false);
            
            // Remover listener após sucesso
            if (authListener) {
              authListener.subscription.unsubscribe();
              authListener = null;
            }
            
            // Limpar hash da URL
            window.history.replaceState({}, document.title, '/reset-password');
            toast.success('Link válido! Você pode redefinir sua senha agora.');
            return;
          }
        }

        // Se chegou até aqui, não conseguimos processar
        console.error('❌ Todos os métodos falharam');
        console.error('❌ URL completa:', window.location.href);
        console.error('❌ Parâmetros disponíveis:', { 
          token: !!token,
          tokenHash: !!tokenHash,
          code: !!code, 
          accessToken: !!accessToken, 
          refreshToken: !!refreshToken, 
          type 
        });
        
        // Remover listener se ainda estiver ativo
        if (authListener) {
          authListener.subscription.unsubscribe();
          authListener = null;
        }
        
        setError('Link de redefinição inválido ou expirado. Solicite um novo link.');
        setValidatingToken(false);
        
      } catch (error: any) {
        console.error('❌ Erro inesperado ao processar link:', error);
        setError(`Erro inesperado: ${error.message}`);
        setValidatingToken(false);
        
        // Limpar listener em caso de erro
        if (authListener) {
          authListener.subscription.unsubscribe();
          authListener = null;
        }
      }
    };

    if (!success) {
      processResetLink();
    }
    
    // Cleanup: remover listener quando componente desmontar
    return () => {
      if (authListener) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [success]);

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    
    if (password.length < 6) {
      errors.push('Deve ter pelo menos 6 caracteres');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Deve conter pelo menos uma letra maiúscula');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Deve conter pelo menos uma letra minúscula');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Deve conter pelo menos um número');
    }
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!newPassword || !confirmPassword) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('A nova senha e a confirmação não coincidem');
      return;
    }
    
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      setError(`A nova senha não atende aos critérios:\n• ${passwordErrors.join('\n• ')}`);
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('🔄 Redefinindo senha...');
      
      // Verificar se temos uma sessão válida
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (session && session.user && !sessionError) {
        console.log('✅ Usando sessão existente para reset');
        
        const result = await passwordService.resetPassword(newPassword);
        
        if (result.success) {
          console.log('✅ Senha redefinida com sucesso!');
          setSuccess(true);
          toast.success('Senha redefinida com sucesso!');
          
          setTimeout(async () => {
            await supabase.auth.signOut();
            navigate('/login');
          }, 2000);
          
        } else {
          setError(result.error || 'Erro ao redefinir senha');
          toast.error(result.error || 'Erro ao redefinir senha');
        }
      } else {
        // Tentar usar token armazenado se não temos sessão
        const resetToken = sessionStorage.getItem('reset_token');
        const resetType = sessionStorage.getItem('reset_type');
        
        if (resetToken) {
          console.log('🔄 Tentando reset com token armazenado...');
          
          try {
            // Tentar verificar o token primeiro
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: resetToken,
              type: resetType as any || 'recovery'
            });
            
            if (!error && data.session) {
              console.log('✅ Token verificado, redefinindo senha...');
              
              const result = await passwordService.resetPassword(newPassword);
              
              if (result.success) {
                console.log('✅ Senha redefinida com sucesso!');
                setSuccess(true);
                toast.success('Senha redefinida com sucesso!');
                
                // Limpar tokens armazenados
                sessionStorage.removeItem('reset_token');
                sessionStorage.removeItem('reset_type');
                
                setTimeout(async () => {
                  await supabase.auth.signOut();
                  navigate('/login');
                }, 2000);
                
              } else {
                setError(result.error || 'Erro ao redefinir senha');
                toast.error(result.error || 'Erro ao redefinir senha');
              }
            } else {
              setError('Token de redefinição inválido ou expirado.');
            }
          } catch (tokenError: any) {
            console.error('❌ Erro ao usar token:', tokenError);
            setError('Erro ao processar token de redefinição.');
          }
        } else {
          setError('Sessão expirada. Solicite um novo link de redefinição.');
        }
      }
    } catch (error: any) {
      console.error('❌ Erro inesperado:', error);
      setError(error.message || 'Erro inesperado ao redefinir senha');
      toast.error(error.message || 'Erro inesperado ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    // Limpar tokens armazenados
    sessionStorage.removeItem('reset_token');
    sessionStorage.removeItem('reset_type');
    navigate('/login');
  };

  const handleRequestNewLink = () => {
    sessionStorage.removeItem('reset_token');
    sessionStorage.removeItem('reset_type');
    navigate('/login');
    toast.info('Use a opção "Esqueci minha senha" para solicitar um novo link.');
  };

  // Tela de validação
  if (validatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-[#D5B170] bg-opacity-20 rounded-full flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-[#D5B170] animate-spin" />
            </div>
            <CardTitle className="text-xl text-[#101F2E]">Validando Link</CardTitle>
            <CardDescription>
              Processando o link de redefinição de senha... Aguarde alguns segundos.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Tela de sucesso
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-xl text-[#101F2E]">Senha Redefinida!</CardTitle>
            <CardDescription>
              Sua senha foi alterada com sucesso. Você será redirecionado para a página de login em instantes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleBackToLogin}
              className="w-full bg-[#D5B170] hover:bg-[#c4a05f] text-[#101F2E] font-medium"
            >
              Ir para Login Agora
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de erro
  if (!sessionValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-xl text-[#101F2E]">Link Inválido</CardTitle>
            <CardDescription className="text-red-600">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={handleRequestNewLink}
              className="w-full bg-[#D5B170] hover:bg-[#c4a05f] text-[#101F2E] font-medium"
            >
              Solicitar Novo Link
            </Button>
            <Button
              variant="outline"
              onClick={handleBackToLogin}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Formulário de redefinição
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-[#D5B170] bg-opacity-20 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-[#D5B170]" />
          </div>
          <CardTitle className="text-xl text-[#101F2E]">Redefinir Senha</CardTitle>
          <CardDescription>
            Digite sua nova senha abaixo. Certifique-se de escolher uma senha segura.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-300 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 whitespace-pre-line">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-[#101F2E] font-medium">
                Nova Senha
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Digite sua nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170] pl-10 pr-10"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#101F2E] font-medium">
                Confirmar Nova Senha
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirme sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170] pl-10 pr-10"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-2">Critérios para a nova senha:</p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`h-3 w-3 ${newPassword.length >= 6 ? 'text-green-500' : 'text-slate-400'}`} />
                  Pelo menos 6 caracteres
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`h-3 w-3 ${/[A-Z]/.test(newPassword) ? 'text-green-500' : 'text-slate-400'}`} />
                  Uma letra maiúscula
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`h-3 w-3 ${/[a-z]/.test(newPassword) ? 'text-green-500' : 'text-slate-400'}`} />
                  Uma letra minúscula
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`h-3 w-3 ${/[0-9]/.test(newPassword) ? 'text-green-500' : 'text-slate-400'}`} />
                  Um número
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#D5B170] hover:bg-[#c4a05f] text-[#101F2E] font-medium"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Redefinindo...
                  </>
                ) : (
                  'Redefinir Senha'
                )}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleBackToLogin}
                disabled={loading}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;