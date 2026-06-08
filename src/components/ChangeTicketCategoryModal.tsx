import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tag, RefreshCw } from 'lucide-react';
import { CategoryService } from '@/services/categoryService';
import { toast } from 'sonner';

type CategoryConfig = Record<string, {
  label: string;
  tagId?: string;
  subcategories: { value: string; label: string; slaHours: number }[];
}>;

type Frente = { id: string; label: string; color: string };

interface ChangeTicketCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCategory: string;
  currentSubcategory?: string;
  onSave: (category: string, subcategory: string) => Promise<void>;
}

const ChangeTicketCategoryModal: React.FC<ChangeTicketCategoryModalProps> = ({
  open,
  onOpenChange,
  currentCategory,
  currentSubcategory,
  onSave,
}) => {
  const [categoriesConfig, setCategoriesConfig] = useState<CategoryConfig>({});
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [frenteId, setFrenteId] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setLoadingCategories(true);
      setFrenteId('');
      setCategory('');
      setSubcategory('');

      try {
        const [config, tags] = await Promise.all([
          CategoryService.getCategoriesConfig(),
          CategoryService.getAllTags(false),
        ]);

        setCategoriesConfig(config);
        setFrentes(tags.map((t) => ({ id: t.id, label: t.label, color: t.color })));

        const catConfig = currentCategory ? config[currentCategory] : undefined;
        const initialFrente = catConfig?.tagId ?? (currentCategory ? 'sem-frente' : '');
        setFrenteId(initialFrente);
        setCategory(currentCategory || '');
        setSubcategory(currentSubcategory || '');
      } catch (error) {
        console.error(error);
        toast.error('Erro ao carregar categorias');
      } finally {
        setLoadingCategories(false);
      }
    };

    void load();
  }, [open, currentCategory, currentSubcategory]);

  const categoriesByFrente = frenteId === ''
    ? []
    : frenteId === 'sem-frente'
      ? Object.entries(categoriesConfig).filter(([, c]) => !c.tagId)
      : Object.entries(categoriesConfig).filter(([, c]) => c.tagId === frenteId);

  const subcategoryOptions = category
    ? (categoriesConfig[category]?.subcategories ?? [])
    : [];

  const getCategoryLabel = (key: string) => categoriesConfig[key]?.label || key;
  const getSubcategoryLabel = (catKey: string, subKey: string) =>
    categoriesConfig[catKey]?.subcategories.find((s) => s.value === subKey)?.label || subKey;
  const getFrenteLabel = (id: string) => {
    if (id === 'sem-frente') return 'Sem Frente de Atuação';
    return frentes.find((f) => f.id === id)?.label || '';
  };

  const handleFrenteChange = (value: string) => {
    setFrenteId(value);
    setCategory('');
    setSubcategory('');
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setSubcategory('');
  };

  const hasChanges =
    category !== (currentCategory || '') ||
    subcategory !== (currentSubcategory || '');

  const handleSave = async () => {
    if (!frenteId) {
      toast.error('Selecione a frente de atuação');
      return;
    }
    if (!category) {
      toast.error('Selecione uma categoria');
      return;
    }
    if (!subcategory) {
      toast.error('Selecione uma subcategoria');
      return;
    }
    if (!hasChanges) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(category, subcategory);
      onOpenChange(false);
    } catch {
      toast.error('Erro ao alterar categoria do ticket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-[#F69F19]" />
            Alterar Categoria
          </DialogTitle>
          <DialogDescription>
            Selecione a frente de atuação, depois a categoria e a subcategoria corretas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {(currentCategory || currentSubcategory) && !loadingCategories && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium text-slate-500">Atual: </span>
              {getCategoryLabel(currentCategory)}
              {currentSubcategory ? ` / ${getSubcategoryLabel(currentCategory, currentSubcategory)}` : ''}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Frente de Atuação <span className="text-red-500">*</span>
            </Label>
            <Select
              value={frenteId}
              onValueChange={handleFrenteChange}
              disabled={loadingCategories}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingCategories ? 'Carregando...' : 'Selecione a frente de atuação'} />
              </SelectTrigger>
              <SelectContent>
                {loadingCategories ? (
                  <div className="px-2 py-1.5 text-sm text-slate-500">Carregando...</div>
                ) : (
                  <>
                    <SelectItem value="sem-frente">Sem Frente de Atuação</SelectItem>
                    {frentes.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: f.color }}
                          />
                          {f.label}
                        </span>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {frenteId && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label className="text-sm font-medium">
                Categoria <span className="text-red-500">*</span>
              </Label>
              <Select
                value={category}
                onValueChange={handleCategoryChange}
                disabled={loadingCategories}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoriesByFrente.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-slate-500">
                      Nenhuma categoria nesta frente
                    </div>
                  ) : (
                    categoriesByFrente
                      .sort(([, a], [, b]) => a.label.localeCompare(b.label, 'pt-BR'))
                      .map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {category && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label className="text-sm font-medium">
                Subcategoria <span className="text-red-500">*</span>
              </Label>
              <Select
                value={subcategory}
                onValueChange={setSubcategory}
                disabled={loadingCategories}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      subcategoryOptions.length === 0
                        ? 'Nenhuma subcategoria disponível'
                        : 'Selecione uma subcategoria'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {subcategoryOptions.map((sub) => (
                    <SelectItem key={sub.value} value={sub.value}>
                      {sub.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {frenteId && category && subcategory && (
            <div className="rounded-lg border border-[#F69F19]/20 bg-[#F69F19]/5 px-3 py-2 text-sm text-slate-700">
              <span className="font-medium text-[#F69F19]">Nova seleção: </span>
              {getFrenteLabel(frenteId)} → {getCategoryLabel(category)} / {getSubcategoryLabel(category, subcategory)}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!frenteId || !category || !subcategory || saving || loadingCategories}
            className="bg-[#F69F19] hover:bg-[#e08e12] text-white"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeTicketCategoryModal;
