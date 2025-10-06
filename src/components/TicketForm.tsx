import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Clock } from 'lucide-react';

// Definição de categorias, subcategorias e seus SLAs
export const CATEGORIES_CONFIG = {
  'protocolo': {
    label: 'Protocolo',
    subcategories: [
      { value: 'pedido_urgencia', label: 'Pedido de urgência', slaHours: 2 },
      { value: 'inconsistencia', label: 'Inconsistência', slaHours: 2 },
      { value: 'duvidas', label: 'Dúvidas', slaHours: 2 }
    ]
  },
  'cadastro': {
    label: 'Cadastro',
    subcategories: [
      { value: 'senhas_outros_tribunais', label: 'Senhas Outros Tribunais', slaHours: 1 },
      { value: 'senha_tribunal_expirada', label: 'Senha Tribunal Expirada', slaHours: 1 },
      { value: 'duvidas', label: 'Dúvidas', slaHours: 24 },
      { value: 'atualizacao_cadastro', label: 'Atualização de Cadastro', slaHours: 24 },
      { value: 'correcao_cadastro', label: 'Correção de Cadastro', slaHours: 24 }
    ]
  },
  'agendamento': {
    label: 'Agendamento',
    subcategories: [
      { value: 'duvidas', label: 'Dúvidas', slaHours: 4 }
    ]
  },
  'publicacoes': {
    label: 'Publicações',
    subcategories: [
      { value: 'problemas_central_publi', label: 'Problemas na central de publi', slaHours: 1 },
      { value: 'duvidas', label: 'Dúvidas', slaHours: 2 }
    ]
  },
  'assinatura_digital': {
    label: 'Assinatura Digital',
    subcategories: [
      { value: 'pedido_urgencia', label: 'Pedido de urgência', slaHours: 3 },
      { value: 'duvidas', label: 'Dúvidas', slaHours: 3 }
    ]
  },
  'outros': {
    label: 'Outros',
    subcategories: [
      { value: 'outros', label: 'Outros', slaHours: 24 }
    ]
  }
};

interface TicketFormProps {
  onSubmit: (data: {
    title: string;
    description: string;
    category: string;
    subcategory: string;
  }) => void;
  onCancel: () => void;
  initialData?: {
    title?: string;
    description?: string;
    category?: string;
    subcategory?: string;
  };
}

const TicketForm: React.FC<TicketFormProps> = ({ onSubmit, onCancel, initialData = {} }) => {
  const [title, setTitle] = useState(initialData.title || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [category, setCategory] = useState(initialData.category || '');
  const [subcategory, setSubcategory] = useState(initialData.subcategory || '');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slaHours, setSlaHours] = useState<number | null>(null);

  // Resetar subcategoria quando a categoria muda
  useEffect(() => {
    setSubcategory('');
    setSlaHours(null);
  }, [category]);

  // Atualizar SLA quando a subcategoria muda
  useEffect(() => {
    if (category && subcategory) {
      const selectedSubcategory = CATEGORIES_CONFIG[category]?.subcategories.find(
        sub => sub.value === subcategory
      );
      
      if (selectedSubcategory) {
        setSlaHours(selectedSubcategory.slaHours);
      } else {
        setSlaHours(null);
      }
    } else {
      setSlaHours(null);
    }
  }, [category, subcategory]);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!title.trim()) {
      newErrors.title = 'O título é obrigatório';
    } else if (title.length < 5) {
      newErrors.title = 'O título deve ter pelo menos 5 caracteres';
    }
    
    if (!description.trim()) {
      newErrors.description = 'A descrição é obrigatória';
    } else if (description.length < 10) {
      newErrors.description = 'A descrição deve ter pelo menos 10 caracteres';
    }
    
    if (!category) {
      newErrors.category = 'A categoria é obrigatória';
    }
    
    if (!subcategory && category) {
      newErrors.subcategory = 'A subcategoria é obrigatória';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onSubmit({
        title,
        description,
        category,
        subcategory,
      });
    } catch (error) {
      console.error('Error submitting ticket:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Digite um título breve para o ticket"
          className={errors.title ? 'border-red-500' : ''}
        />
        {errors.title && (
          <p className="text-red-500 text-xs flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" />
            {errors.title}
          </p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva seu problema ou solicitação em detalhes"
          rows={5}
          className={errors.description ? 'border-red-500' : ''}
        />
        {errors.description && (
          <p className="text-red-500 text-xs flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" />
            {errors.description}
          </p>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Categoria</Label>
          <Select
            value={category}
            onValueChange={setCategory}
          >
            <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORIES_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-red-500 text-xs flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" />
              {errors.category}
            </p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="subcategory">Subcategoria</Label>
          <Select
            value={subcategory}
            onValueChange={setSubcategory}
            disabled={!category}
          >
            <SelectTrigger className={errors.subcategory ? 'border-red-500' : ''}>
              <SelectValue placeholder="Selecione uma subcategoria" />
            </SelectTrigger>
            <SelectContent>
              {category && CATEGORIES_CONFIG[category]?.subcategories.map((sub) => (
                <SelectItem key={sub.value} value={sub.value}>
                  {sub.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.subcategory && (
            <p className="text-red-500 text-xs flex items-center">
              <AlertCircle className="h-3 w-3 mr-1" />
              {errors.subcategory}
            </p>
          )}
        </div>
      </div>
      
      {slaHours !== null && (
        <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
          <div className="flex items-center text-sm text-slate-700">
            <Clock className="h-4 w-4 mr-2 text-blue-500" />
            <span>
              <strong>Tempo estimado de atendimento:</strong> {slaHours} {slaHours === 1 ? 'hora' : 'horas'}
            </span>
          </div>
        </div>
      )}
      
      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-[#D5B170] hover:bg-[#c4a05f] text-white"
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            'Enviar'
          )}
        </Button>
      </div>
    </form>
  );
};

export default TicketForm;