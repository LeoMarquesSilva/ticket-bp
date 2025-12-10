import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, RefreshCw, ArrowLeft, Info } from 'lucide-react';
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
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [showDebug, setShowDebug] = useState(false);
  
  const navigate = useNavigate();

  // Função para extrair TODOS os parâmetros possíveis da URL
  const extractAllUrlParams = () => {
    const currentUrl = window.location.href;
    const urlObj = new URL(currentUrl);
    
    // Query parameters
    const queryParams: any = {};
    urlObj.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    
    // Hash parameters
    const hashParams: any = {};
    if (urlObj.hash) {
      const hashString = urlObj.hash.substring(1);
      const hashSearchParams = new URLSearchParams(hashString);
      hashSearchParams.forEach((value, key) => {
        hashParams[key] = value;
      });
    }
    
    // Também tentar extrair manualmente do hash se não funcionou com URLSearchParams
    const manualHashParams: any = {};
    if (urlObj.hash) {
      const hashString = urlObj.hash.substring(1);
      const pairs = hashString.split('&');
      pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          manualHashParams[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
    }
    
    return {
      fullUrl: currentUrl,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash,
      queryParams,
      hashParams,
      manualHashParams
    };
  };

  useEffect(() => {
    const validateTokenAndSetSession = async () => {
      try {
        console.log('🔍 === INICIANDO DEBUG DE RESET DE SENHA ===');
        
        // Capturar TODOS os dados da URL
        const urlData = extractAllUrlParams();
        console.log('📍 Dados completos da URL:', urlData);
        
        setDebugInfo(urlData);
        
        // Tentar extrair tokens de todas as formas possíveis
        let accessToken = null;
        let refreshToken = null;
        let type = null;
        
        // Método 1: Query parameters
        if (urlData.queryParams.access_token) {
          accessToken = urlData.queryParams.access_token;
          refreshToken = urlData.queryParams.refresh_token;
          type = urlData.queryParams.type;
          console.log('✅ Tokens encontrados em query params');
        }
        
        // Método 2: Hash parameters (URLSearchParams)
        if (!accessToken && urlData.hashParams.access_token) {
          accessToken = urlData.hashParams.access_token;
          refreshToken = urlData.hashParams.refresh_token;
          type = urlData.hashParams.type;
          console.log('✅ Tokens encontrados em hash params (URLSearchParams)');
        }
        
        // Método 3: Hash parameters (manual)
        if (!accessToken && urlData.manualHashParams.access_token) {
          accessToken = urlData.manualHashParams.access_token;
          refreshToken = urlData.manualHashParams.refresh_token;
          type = urlData.manualHashParams.type;
          console.log('✅ Tokens encontrados em hash params (manual)');
        }
        
        // Método 4: Tentar usar o método nativo do Supabase
        if (!accessToken) {
          console.log('🔄 Tentando método nativo do Supabase...');
          
          // O Supabase pode processar automaticamente se detectSessionInUrl estiver habilitado
          const { data: sessionData, error: sessionCheckError } = await supabase.auth.getSession();
          
          if (sessionData.session && !sessionCheckError) {
            console.log('✅ Sessão já processada automaticamente pelo Supabase!');
            console.log('👤 Usuário da sessão:', sessionData.session.user.email);
            setSessionValid(true);
            setValidatingToken(false);
            return;
          }
        }
        
        console.log('📋 Tokens extraídos:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type: type,
          accessTokenLength: accessToken?.length || 0,
          refreshTokenLength: refreshToken?.length || 0
        });
        
        // Verificar se temos os tokens necessários
        if (!accessToken || !refreshToken) {
          console.error('❌ Tokens não encontrados em nenhum método');
          console.error('❌ URL completa:', window.location.href);
          console.error('❌ Hash:', window.location.hash);
          console.error('❌ Search:', window.location.search);
          
          setError('Link de redefinição inválido ou expirado. Solicite um novo link.');
          setValidatingToken(false);
          return;
        }
        
        // Verificar se é um link de recovery (se o tipo estiver presente)
        if (type && type !== 'recovery') {
          console.error('❌ Tipo de link inválido:', type);
          setError('Link de redefinição inválido. Solicite um novo link.');
          setValidatingToken(false);
          return;
        }
        
        console.log('🔄 Configurando sessão com tokens...');
        console.log('🔑 Access token (primeiros 50 chars):', accessToken.substring(0, 50) + '...');
        console.log('🔄 Refresh token (primeiros 50 chars):', refreshToken.substring(0, 50) + '...');
        
        // Configurar a sessão com os tokens
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        console.log('📊 Resultado do setSession:', {
          hasData: !!data,
          hasSession: !!data?.session,
          hasUser: !!data?.user,
          error: sessionError?.message || 'nenhum'
        });
        
        if (sessionError) {
          console.error('❌ Erro ao configurar sessão:', sessionError);
          
          // Log detalhado do erro
          console.error('❌ Detalhes do erro:', {
            message: sessionError.message,
            status: (sessionError as any).status,
            code: (sessionError as any).code
          });
          
          // Tratar erros específicos
          if (sessionError.message.includes('expired') || sessionError.message.includes('Invalid')) {
            setError('Link de redefinição expirado. Solicite um novo link.');
          } else if (sessionError.message.includes('invalid')) {
            setError('Link de redefinição inválido. Solicite um novo link.');
          } else {
            setError(`Erro ao processar link: ${sessionError.message}`);
          }
          
          setValidatingToken(false);
          return;
        }
        
        if (!data.session || !data.user) {
          console.error('❌ Sessão não foi criada corretamente');
          console.error('❌ Data:', data);
          setError('Erro ao processar link de redefinição. Solicite um novo link.');
          setValidatingToken(false);
          return;
        }
        
        console.log('✅ Sessão configurada com sucesso!');
        console.log('👤 Usuário:', data.user.email);
        console.log('🆔 User ID:', data.user.id);
        console.log('🕐 Sessão expira em:', new Date(data.session.expires_at! * 1000));
        
        setSessionValid(true);
        setValidatingToken(false);
        
        // Limpar a URL dos parâmetros sensíveis para segurança
        window.history.replaceState({}, document.title, '/reset-password');
        
        toast.success('Link válido! Você pode redefinir sua senha agora.');
        
      } catch (error: any) {
        console.error('❌ Erro inesperado ao processar link:', error);
        console.error('❌ Stack trace:', error.stack);
        setError(`Erro inesperado: ${error.message}`);
        setValidatingToken(false);
      }
    };

    // Só executar se não estamos em estado de sucesso
    if (!success) {
      validateTokenAndSetSession();
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
    
    // Validações
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
      console.log('🔄 Iniciando redefinição de senha...');
      
      // Verificar se ainda temos uma sessão válida
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('❌ Sessão não encontrada ou expirada:', sessionError);
        setError('Sessão expirada. Solicite um novo link de redefinição.');
        setLoading(false);
        return;
      }
      
      console.log('✅ Sessão válida encontrada, redefinindo senha...');
      
      const result = await passwordService.resetPassword(newPassword);
      
      if (result.success) {
        console.log('✅ Senha redefinida com sucesso!');
        setSuccess(true);
        toast.success('Senha redefinida com sucesso!');
        
        // Fazer logout da sessão temporária
        await supabase.auth.signOut();
        
        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        console.error('❌ Erro ao redefinir senha:', result.error);
        setError(result.error || 'Erro ao redefinir senha');
        toast.error(result.error || 'Erro ao redefinir senha');
      }
    } catch (error: any) {
      console.error('❌ Erro inesperado ao redefinir senha:', error);
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

  // Tela de validação do token
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
              Verificando o link de redefinição de senha...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="w-full mb-4"
            >
              <Info className="mr-2 h-4 w-4" />
              {showDebug ? 'Ocultar' : 'Mostrar'} Informações de Debug
            </Button>
            
            {showDebug && (
              <div className="bg-slate-100 p-3 rounded-lg text-xs font-mono">
                <pre className="whitespace-pre-wrap overflow-auto max-h-40">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
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

  // Tela de erro (link inválido)
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
              variant="outline"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="w-full"
            >
              <Info className="mr-2 h-4 w-4" />
              {showDebug ? 'Ocultar' : 'Mostrar'} Informações de Debug
            </Button>
            
            {showDebug && (
              <div className="bg-slate-100 p-3 rounded-lg text-xs font-mono mb-4">
                <pre className="whitespace-pre-wrap overflow-auto max-h-40">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
            
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

  // Formulário de redefinição de senha
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
            {/* Nova Senha */}
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

            {/* Confirmar Nova Senha */}
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

            {/* Critérios de Senha */}
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

            {/* Botões */}
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