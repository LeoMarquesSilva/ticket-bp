import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Clock, Send } from 'lucide-react';
import { CategoryService } from '@/services/categoryService';

// Configuração hardcoded como fallback (caso haja erro ao buscar do banco)
const FALLBACK_CATEGORIES_CONFIG: Record<string, { label: string; subcategories: { value: string; label: string; slaHours: number }[] }> = {
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

// Exportar para compatibilidade com outros componentes que ainda podem estar usando
export const CATEGORIES_CONFIG = FALLBACK_CATEGORIES_CONFIG;

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
  const [categoriesConfig, setCategoriesConfig] = useState<Record<string, { label: string; subcategories: { value: string; label: string; slaHours: number }[] }>>(FALLBACK_CATEGORIES_CONFIG);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Gradiente oficial da marca
  const brandGradient = 'linear-gradient(90deg, rgba(246, 159, 25, 1) 0%, rgba(222, 85, 50, 1) 50%, rgba(189, 45, 41, 1) 100%)';

  // Carregar categorias do banco de dados
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true);
        const config = await CategoryService.getCategoriesConfig();
        setCategoriesConfig(config);
      } catch (error) {
        console.error('Erro ao carregar categorias do banco, usando fallback:', error);
        // Manter fallback se houver erro
        setCategoriesConfig(FALLBACK_CATEGORIES_CONFIG);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  // Resetar subcategoria quando a categoria muda
  useEffect(() => {
    setSubcategory('');
    setSlaHours(null);
  }, [category]);

  // Atualizar SLA quando a subcategoria muda
  useEffect(() => {
    if (category && subcategory) {
      const selectedSubcategory = categoriesConfig[category]?.subcategories.find(
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
  }, [category, subcategory, categoriesConfig]);

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
    <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <Label htmlFor="title" className="text-[#2C2D2F] font-medium">Título</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Digite um título breve para o ticket"
          className={`border-slate-300 focus:border-[#F69F19] focus:ring-[#F69F19]/20 transition-all ${errors.title ? 'border-[#BD2D29] focus:ring-[#BD2D29]/20' : ''}`}
        />
        {errors.title && (
          <p className="text-[#BD2D29] text-xs flex items-center mt-1">
            <AlertCircle className="h-3 w-3 mr-1" />
            {errors.title}
          </p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description" className="text-[#2C2D2F] font-medium">Descrição</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva seu problema ou solicitação em detalhes"
          rows={5}
          className={`border-slate-300 focus:border-[#F69F19] focus:ring-[#F69F19]/20 transition-all ${errors.description ? 'border-[#BD2D29] focus:ring-[#BD2D29]/20' : ''}`}
        />
        {errors.description && (
          <p className="text-[#BD2D29] text-xs flex items-center mt-1">
            <AlertCircle className="h-3 w-3 mr-1" />
            {errors.description}
          </p>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category" className="text-[#2C2D2F] font-medium">Categoria</Label>
          <Select
            value={category}
            onValueChange={setCategory}
          >
            <SelectTrigger className={`border-slate-300 focus:ring-[#F69F19]/20 transition-all ${errors.category ? 'border-[#BD2D29] focus:ring-[#BD2D29]/20' : ''}`}>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {loadingCategories ? (
                <div className="px-2 py-1.5 text-sm text-slate-500">Carregando categorias...</div>
              ) : (
                Object.entries(categoriesConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-[#BD2D29] text-xs flex items-center mt-1">
              <AlertCircle className="h-3 w-3 mr-1" />
              {errors.category}
            </p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="subcategory" className="text-[#2C2D2F] font-medium">Subcategoria</Label>
          <Select
            value={subcategory}
            onValueChange={setSubcategory}
            disabled={!category}
          >
            <SelectTrigger className={`border-slate-300 focus:ring-[#F69F19]/20 transition-all ${errors.subcategory ? 'border-[#BD2D29] focus:ring-[#BD2D29]/20' : ''}`}>
              <SelectValue placeholder="Selecione uma subcategoria" />
            </SelectTrigger>
            <SelectContent>
              {category && categoriesConfig[category]?.subcategories.map((sub) => (
                <SelectItem key={sub.value} value={sub.value}>
                  {sub.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.subcategory && (
            <p className="text-[#BD2D29] text-xs flex items-center mt-1">
              <AlertCircle className="h-3 w-3 mr-1" />
              {errors.subcategory}
            </p>
          )}
        </div>
      </div>
      
      {slaHours !== null && (
        <div className="bg-[#F69F19]/5 p-4 rounded-lg border border-[#F69F19]/20 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center text-sm text-slate-700">
            <div className="p-1.5 bg-white rounded-full shadow-sm mr-3">
              <Clock className="h-4 w-4 text-[#F69F19]" />
            </div>
            <span>
              Tempo estimado de atendimento: <strong>{slaHours} {slaHours === 1 ? 'hora' : 'horas'}</strong>
            </span>
          </div>
        </div>
      )}
      
      <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 mt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
          className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="text-white font-bold shadow-md border-0 hover:opacity-90 transition-opacity"
          style={{ background: brandGradient }}
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Enviar Solicitação
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default TicketForm;
