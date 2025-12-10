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
    const processResetLink = async () => {
      try {
        console.log('🔍 === PROCESSANDO LINK DE RESET (VERSÃO UNIVERSAL) ===');
        console.log('📍 URL atual:', window.location.href);
        
        // Aguardar um pouco para o Supabase processar automaticamente
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Primeiro, verificar se o Supabase já processou automaticamente
        let { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        console.log('📊 Primeira verificação de sessão:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userEmail: session?.user?.email,
          error: sessionError?.message || 'nenhum'
        });
        
        // Se já temos uma sessão válida, ótimo!
        if (session && session.user && !sessionError) {
          console.log('✅ Sessão já processada automaticamente pelo Supabase!');
          setSessionValid(true);
          setValidatingToken(false);
          toast.success('Link válido! Você pode redefinir sua senha agora.');
          return;
        }
        
        // Se não temos sessão, vamos tentar forçar o processamento
        console.log('🔄 Tentando forçar processamento do link...');
        
        // Extrair todos os parâmetros possíveis
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        const allParams = {
          // Query parameters
          code: urlParams.get('code'),
          access_token: urlParams.get('access_token'),
          refresh_token: urlParams.get('refresh_token'),
          token: urlParams.get('token'),
          type: urlParams.get('type'),
          // Hash parameters
          hash_code: hashParams.get('code'),
          hash_access_token: hashParams.get('access_token'),
          hash_refresh_token: hashParams.get('refresh_token'),
          hash_token: hashParams.get('token'),
          hash_type: hashParams.get('type'),
        };
        
        console.log('🔑 Todos os parâmetros encontrados:', allParams);
        
        // Tentar diferentes abordagens
        
        // Abordagem 1: Se temos tokens diretos
        const accessToken = allParams.access_token || allParams.hash_access_token;
        const refreshToken = allParams.refresh_token || allParams.hash_refresh_token;
        
        if (accessToken && refreshToken) {
          console.log('🔄 Tentativa 1: Configurando sessão com tokens diretos...');
          
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (!error && data.session && data.user) {
              console.log('✅ Sucesso com tokens diretos!');
              setSessionValid(true);
              setValidatingToken(false);
              window.history.replaceState({}, document.title, '/reset-password');
              toast.success('Link válido! Você pode redefinir sua senha agora.');
              return;
            }
          } catch (e) {
            console.log('❌ Falha com tokens diretos:', e);
          }
        }
        
        // Abordagem 2: Se temos um código PKCE
        const code = allParams.code || allParams.hash_code;
        
        if (code) {
          console.log('🔄 Tentativa 2: Processando código PKCE...');
          
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (!error && data.session && data.user) {
              console.log('✅ Sucesso com código PKCE!');
              setSessionValid(true);
              setValidatingToken(false);
              window.history.replaceState({}, document.title, '/reset-password');
              toast.success('Link válido! Você pode redefinir sua senha agora.');
              return;
            } else {
              console.log('❌ Falha com código PKCE:', error);
            }
          } catch (e) {
            console.log('❌ Erro no código PKCE:', e);
          }
        }
        
        // Abordagem 3: Tentar usar o método de verificação de token
        const token = allParams.token || allParams.hash_token;
        const type = allParams.type || allParams.hash_type;
        
        if (token && type === 'recovery') {
          console.log('🔄 Tentativa 3: Verificando token de recovery...');
          
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
              console.log('❌ Falha com token de recovery:', error);
            }
          } catch (e) {
            console.log('❌ Erro no token de recovery:', e);
          }
        }
        
        // Abordagem 4: Aguardar mais um pouco e verificar novamente
        console.log('🔄 Tentativa 4: Aguardando processamento automático...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const { data: { session: finalSession }, error: finalError } = await supabase.auth.getSession();
        
        if (finalSession && finalSession.user && !finalError) {
          console.log('✅ Sessão encontrada após aguardar!');
          setSessionValid(true);
          setValidatingToken(false);
          toast.success('Link válido! Você pode redefinir sua senha agora.');
          return;
        }
        
        // Se chegou até aqui, não conseguimos processar
        console.error('❌ Não foi possível processar o link de reset');
        console.error('❌ URL completa:', window.location.href);
        console.error('❌ Parâmetros:', allParams);
        
        setError('Link de redefinição inválido ou expirado. Solicite um novo link.');
        setValidatingToken(false);
        
      } catch (error: any) {
        console.error('❌ Erro inesperado ao processar link:', error);
        setError(`Erro inesperado: ${error.message}`);
        setValidatingToken(false);
      }
    };

    if (!success) {
      processResetLink();
    }
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
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('❌ Sessão não encontrada:', sessionError);
        setError('Sessão expirada. Solicite um novo link de redefinição.');
        setLoading(false);
        return;
      }
      
      console.log('✅ Sessão válida, redefinindo senha...');
      
      const result = await passwordService.resetPassword(newPassword);
      
      if (result.success) {
        console.log('✅ Senha redefinida com sucesso!');
        setSuccess(true);
        toast.success('Senha redefinida com sucesso!');
        
        // Aguardar um pouco antes de fazer logout e redirecionar
        setTimeout(async () => {
          await supabase.auth.signOut();
          navigate('/login');
        }, 2000);
        
      } else {
        console.error('❌ Erro ao redefinir senha:', result.error);
        setError(result.error || 'Erro ao redefinir senha');
        toast.error(result.error || 'Erro ao redefinir senha');
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
    navigate('/login');
  };

  const handleRequestNewLink = () => {
    navigate('/login');
    toast.info('Use a opção "Esqueci minha senha" para solicitar um novo link.');
  };

  // Tela de validação (com mais tempo)
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
              Processando o link de redefinição de senha... Isso pode levar alguns segundos.
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