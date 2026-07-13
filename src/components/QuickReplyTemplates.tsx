import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageSquare, Loader2 } from 'lucide-react';
import { QuickReplyTemplateService, QuickReplyTemplate } from '@/services/quickReplyTemplates';

interface QuickReplyTemplatesProps {
  onSelectTemplate: (message: string) => void;
  disabled?: boolean;
}

const QuickReplyTemplates: React.FC<QuickReplyTemplatesProps> = ({
  onSelectTemplate,
  disabled = false,
}) => {
  const [templates, setTemplates] = useState<QuickReplyTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QuickReplyTemplateService.getAll().then((data) => {
      if (!cancelled) {
        setTemplates(data);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleSelectTemplate = (template: QuickReplyTemplate) => {
    onSelectTemplate(template.message);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          className="h-9 w-9 border-slate-200 hover:bg-slate-50 hover:border-[#F69F19]/30 hover:text-[#F69F19] transition-colors"
          title="Templates de resposta rápida"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-[400px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#F69F19]" />
          Respostas Rápidas
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!loaded && (
          <div className="flex items-center justify-center py-4 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {loaded && templates.length === 0 && (
          <p className="px-2 py-3 text-xs text-slate-500">
            Nenhuma resposta rápida cadastrada ainda. Peça a um administrador para configurar em Gerenciar Categorias.
          </p>
        )}
        {templates.map((template) => (
          <DropdownMenuItem
            key={template.id}
            onClick={() => handleSelectTemplate(template)}
            className="flex flex-col items-start gap-1 py-2 cursor-pointer hover:bg-slate-50"
          >
            <span className="font-medium text-sm text-[#2C2D2F]">{template.label}</span>
            <span className="text-xs text-slate-500 line-clamp-2">{template.message}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default QuickReplyTemplates;
