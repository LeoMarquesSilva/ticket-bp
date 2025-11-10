import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { UserService } from '@/services/userService';
import { User } from '@/types';
import { toast } from 'sonner';

interface TransferTicketButtonProps {
  ticketId: string;
  currentAssignee?: string;
  onTransfer: (supportId: string, supportName: string) => Promise<void>;
}

const TransferTicketButton: React.FC<TransferTicketButtonProps> = ({
  ticketId,
  currentAssignee,
  onTransfer,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [supportUsers, setSupportUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Carregar usuários de suporte
  useEffect(() => {
    const loadSupportUsers = async () => {
      try {
        setIsLoadingUsers(true);
        const users = await UserService.getSupportUsers();
        // Filtrar o usuário atual da lista
        const filteredUsers = users.filter(user => user.id !== currentAssignee);
        setSupportUsers(filteredUsers);
      } catch (error) {
        console.error('Error loading support users:', error);
        toast.error('Erro ao carregar usuários de suporte');
      } finally {
        setIsLoadingUsers(false);
      }
    };

    if (isOpen) {
      loadSupportUsers();
    }
  }, [isOpen, currentAssignee]);

  const handleTransfer = async () => {
    if (!selectedUser) {
      toast.error('Selecione um usuário para transferir o ticket');
      return;
    }

    try {
      setIsLoading(true);
      const selectedUserData = supportUsers.find(user => user.id === selectedUser);
      
      if (!selectedUserData) {
        toast.error('Usuário selecionado não encontrado');
        return;
      }
      
      await onTransfer(selectedUser, selectedUserData.name);
      setIsOpen(false);
      toast.success(`Ticket transferido para ${selectedUserData.name}`);
    } catch (error) {
      console.error('Error transferring ticket:', error);
      toast.error('Erro ao transferir ticket');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Transferir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir Ticket</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {isLoadingUsers ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#D5B170]"></div>
            </div>
          ) : supportUsers.length === 0 ? (
            <div className="text-center py-4 text-slate-500">
              Não há outros usuários de suporte disponíveis
            </div>
          ) : (
            <RadioGroup value={selectedUser} onValueChange={setSelectedUser}>
              {supportUsers.map((user) => (
                <div key={user.id} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50">
                  <RadioGroupItem value={user.id} id={user.id} />
                  <Label htmlFor={user.id} className="flex items-center justify-between w-full cursor-pointer">
                    <span>
                      {user.name}
                      <span className="text-xs text-slate-500 ml-2">
                        ({user.role === 'lawyer' ? 'Advogado' : 'Suporte'})
                      </span>
                    </span>
                    {user.isOnline ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        Offline
                      </span>
                    )}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleTransfer} 
            disabled={!selectedUser || isLoading}
            className="bg-[#D5B170] hover:bg-[#c4a05f] text-white"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              'Transferir'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransferTicketButton;