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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Lock className="h-5 w-5 text-[#D5B170]" />
            {isFirstLogin ? 'Alteração de Senha Obrigatória' : 'Alterar Senha'}
          </DialogTitle>
          <DialogDescription>
            {isFirstLogin 
              ? 'Por segurança, você deve alterar sua senha no primeiro acesso ao sistema.'
              : 'Digite sua senha atual e escolha uma nova senha segura.'
            }
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="border-red-300 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 whitespace-pre-line">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Senha Atual */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-[#101F2E] font-medium">
              Senha Atual
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                placeholder="Digite sua senha atual"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
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
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4 text-slate-400" />
                ) : (
                  <Eye className="h-4 w-4 text-slate-400" />
                )}
              </Button>
            </div>
          </div>

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
          <div className="flex gap-3 pt-4">
            {!isFirstLogin && onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
                className="flex-1"
              >
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              disabled={loading}
              className={`${isFirstLogin ? 'w-full' : 'flex-1'} bg-[#D5B170] hover:bg-[#c4a05f] text-[#101F2E] font-medium`}
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                'Alterar Senha'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordModal;