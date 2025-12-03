import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, RefreshCw, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // ✅ Importação adicionada
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
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Verificar se há um token de reset na URL
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    
    if (!accessToken || !refreshToken) {
      setError('Link de redefinição inválido ou expirado. Solicite um novo link.');
      return;
    }

    // Configurar a sessão com os tokens
    const setSession = async () => {
      try {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (error) {
          console.error('Erro ao configurar sessão:', error);
          setError('Link de redefinição inválido ou expirado. Solicite um novo link.');
        }
      } catch (error) {
        console.error('Erro ao configurar sessão:', error);
        setError('Erro ao processar link de redefinição.');
      }
    };

    setSession();
  }, [searchParams]);

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
      const result = await passwordService.resetPassword(newPassword);
      
      if (result.success) {
        setSuccess(true);
        toast.success('Senha redefinida com sucesso!');
        
        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(result.error || 'Erro ao redefinir senha');
        toast.error(result.error || 'Erro ao redefinir senha');
      }
    } catch (error: any) {
      setError(error.message || 'Erro ao redefinir senha');
      toast.error(error.message || 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

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
              Sua senha foi alterada com sucesso. Você será redirecionado para a página de login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleBackToLogin}
              className="w-full bg-[#D5B170] hover:bg-[#c4a05f] text-[#101F2E] font-medium"
            >
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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