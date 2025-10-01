import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import TicketForm from '@/components/TicketForm';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    category: string;
    subcategory: string;
  }) => void;
}

const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const handleSubmit = async (data: {
    title: string;
    description: string;
    category: string;
    subcategory: string;
  }) => {
    await onSubmit(data);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-800">
            Criar Novo Ticket
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Preencha os detalhes abaixo para criar um novo ticket de suporte.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <TicketForm onSubmit={handleSubmit} onCancel={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTicketModal;