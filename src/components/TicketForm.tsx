import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TicketPriority } from '@/types';

interface TicketFormProps {
  onSubmit: (ticketData: {
    title: string;
    description: string;
    priority: TicketPriority;
    category: string;
  }) => Promise<void>;
  onCancel: () => void;
}

const TicketForm: React.FC<TicketFormProps> = ({ onSubmit, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Novas categorias conforme solicitado
  const categories = [
    'Protocolo',
    'Agendamento',
    'Cadastro',
    'Publicações'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim() || !category) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        priority: 'medium', // Definindo prioridade padrão como média
        category,
      });
    } catch (error) {
      console.error('Error submitting ticket:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Descreva brevemente o problema ou solicitação"
            required
            disabled={isSubmitting}
            className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição *</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Forneça detalhes sobre sua solicitação, incluindo contexto e informações relevantes"
            rows={4}
            required
            disabled={isSubmitting}
            className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170] resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoria *</Label>
          <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
            <SelectTrigger className="border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]">
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !title.trim() || !description.trim() || !category}
          className="bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white shadow-lg"
        >
          {isSubmitting ? 'Criando...' : 'Criar Ticket'}
        </Button>
      </div>
    </form>
  );
};

export default TicketForm;