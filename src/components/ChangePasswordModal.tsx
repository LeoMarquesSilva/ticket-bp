import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { passwordService } from '@/services/passwordService';
import { toast } from 'sonner';

interface ChangePasswordModalProps {
  open: boolean;
  isFirstLogin: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  open,
  isFirstLogin,
  onSuccess,
  onCancel
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Gradiente oficial da marca
  const brandGradient = 'linear-gradient(90deg, rgba(246, 159, 25, 1) 0%, rgba(222, 85, 50, 1) 50%, rgba(189, 45, 41, 1) 100%)';

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
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('A nova senha e a confirmação não coincidem');
      return;
    }
    
    if (currentPassword === newPassword) {
      setError('A nova senha deve ser diferente da senha atual');
      return;
    }
    
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      setError(`A nova senha não atende aos critérios:\n• ${passwordErrors.join('\n• ')}`);
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await passwordService.changePassword(currentPassword, newPassword);
      
      if (result.success) {
        toast.success('Senha alterada com sucesso!');
        onSuccess();
        // Limpar campos
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(result.error || 'Erro ao alterar senha');
        toast.error(result.error || 'Erro ao alterar senha');
      }
    } catch (error: any) {
      setError(error.message || 'Erro ao alterar senha');
      toast.error(error.message || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  // Função para lidar com tentativa de fechar o modal
  const handleOpenChange = (open: boolean) => {
    // Se é primeiro login, não permite fechar
    if (isFirstLogin) {
      return;
    }
    // Se não é primeiro login e tem função de cancelar, chama ela
    if (!open && onCancel) {
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-0 shadow-2xl gap-0">
        {/* Barra de gradiente no topo */}
        <div className="h-[3px] w-full" style={{ background: brandGradient }}></div>
        
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-xl text-[#2C2D2F]">
              <div className="p-2 bg-[#F69F19]/10 rounded-lg">
                <Lock className="h-5 w-5 text-[#F69F19]" />
              </div>
              {isFirstLogin ? 'Alteração de Senha Obrigatória' : 'Alterar Senha'}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {isFirstLogin 
                ? 'Por segurança, você deve alterar sua senha no primeiro acesso ao sistema.'
                : 'Digite sua senha atual e escolha uma nova senha segura.'
              }
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert className="mb-4 border-[#BD2D29]/30 bg-[#BD2D29]/5">
              <AlertCircle className="h-4 w-4 text-[#BD2D29]" />
              <AlertDescription className="text-[#BD2D29] whitespace-pre-line font-medium">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Senha Atual */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-[#2C2D2F] font-medium">
                Senha Atual
              </Label>
              <div className="relative group">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Digite sua senha atual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={loading}
                  className="border-slate-300 focus:border-[#F69F19] focus:ring-[#F69F19]/20 pl-10 pr-10 transition-all"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#F69F19] transition-colors">
                  <Lock className="h-4 w-4" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-400 hover:text-[#F69F19]" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400 hover:text-[#F69F19]" />
                  )}
                </Button>
              </div>
            </div>

            {/* Nova Senha */}
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-[#2C2D2F] font-medium">
                Nova Senha
              </Label>
              <div className="relative group">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Digite sua nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  className="border-slate-300 focus:border-[#F69F19] focus:ring-[#F69F19]/20 pl-10 pr-10 transition-all"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#F69F19] transition-colors">
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
                    <EyeOff className="h-4 w-4 text-slate-400 hover:text-[#F69F19]" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400 hover:text-[#F69F19]" />
                  )}
                </Button>
              </div>
            </div>

            {/* Confirmar Nova Senha */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#2C2D2F] font-medium">
                Confirmar Nova Senha
              </Label>
              <div className="relative group">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirme sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="border-slate-300 focus:border-[#F69F19] focus:ring-[#F69F19]/20 pl-10 pr-10 transition-all"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#F69F19] transition-colors">
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
                    <EyeOff className="h-4 w-4 text-slate-400 hover:text-[#F69F19]" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400 hover:text-[#F69F19]" />
                  )}
                </Button>
              </div>
            </div>

            {/* Critérios de Senha */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <p className="text-sm font-semibold text-[#2C2D2F] mb-3">Critérios de segurança:</p>
              <ul className="text-xs text-slate-600 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${newPassword.length >= 6 ? 'text-green-500' : 'text-slate-300'}`} />
                  <span className={newPassword.length >= 6 ? 'text-slate-900' : ''}>Pelo menos 6 caracteres</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${/[A-Z]/.test(newPassword) ? 'text-green-500' : 'text-slate-300'}`} />
                  <span className={/[A-Z]/.test(newPassword) ? 'text-slate-900' : ''}>Uma letra maiúscula</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${/[a-z]/.test(newPassword) ? 'text-green-500' : 'text-slate-300'}`} />
                  <span className={/[a-z]/.test(newPassword) ? 'text-slate-900' : ''}>Uma letra minúscula</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${/[0-9]/.test(newPassword) ? 'text-green-500' : 'text-slate-300'}`} />
                  <span className={/[0-9]/.test(newPassword) ? 'text-slate-900' : ''}>Um número</span>
                </li>
              </ul>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              {!isFirstLogin && onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={loading}
                  className="flex-1 border-slate-200 hover:bg-slate-50 text-slate-700"
                >
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                disabled={loading}
                className={`${isFirstLogin ? 'w-full' : 'flex-1'} text-white font-bold shadow-md border-0 transition-opacity hover:opacity-90`}
                style={{ background: brandGradient }}
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  'Confirmar Alteração'
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordModal;
