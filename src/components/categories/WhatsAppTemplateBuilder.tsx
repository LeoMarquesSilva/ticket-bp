import { Button } from '@/components/ui/button';
import { Braces, LayoutTemplate } from 'lucide-react';

export const whatsappTemplateVariables = [
  { token: '{title}', label: 'Titulo' },
  { token: '{requester}', label: 'Solicitante' },
  { token: '{requestedAtLocal}', label: 'Data/hora' },
  { token: '{categoryLabel}', label: 'Categoria' },
  { token: '{subcategoryLabel}', label: 'Subcategoria' },
  { token: '{description}', label: 'Descricao' },
  { token: '{priority}', label: 'Prioridade' },
];

export const quickTemplateOptions = [
  {
    id: 'alerta',
    label: 'Alerta novo ticket',
    template: `🎫 Novo ticket\n👤 Solicitante: {requester}\n🕒 Solicitado em: {requestedAtLocal}\n📁 {categoryLabel} / {subcategoryLabel}\n📝 {description}`,
  },
  {
    id: 'resumo',
    label: 'Resumo estruturado',
    template: `🚨 Chamado aberto\nTitulo: {title}\nSolicitante: {requester}\nData/hora: {requestedAtLocal}\nCategoria: {categoryLabel}\nSubcategoria: {subcategoryLabel}\nDescricao: {description}`,
  },
];

export function appendTemplateToken(current: string, token: string) {
  if (!current) return token;
  const needsSeparator = !current.endsWith(' ') && !current.endsWith('\n');
  return `${current}${needsSeparator ? ' ' : ''}${token}`;
}

interface Props {
  disabled?: boolean;
  onInsertVariable: (token: string) => void;
  onApplyQuickTemplate: (template: string) => void;
}

export default function WhatsAppTemplateBuilder({ disabled, onInsertVariable, onApplyQuickTemplate }: Props) {
  return (
    <div className="space-y-3 border-t border-slate-200 pt-3">
      <div className="flex items-start gap-3">
        <Braces className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
        <div className="flex flex-wrap gap-1.5">
        {whatsappTemplateVariables.map((item) => (
          <Button
            key={item.token}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:border-[#DE5532]/40 hover:bg-[#DE5532]/5 hover:text-[#BD2D29]"
            disabled={disabled}
            onClick={() => onInsertVariable(item.token)}
          >
            {item.label} <span className="ml-1 font-mono text-[10px] text-slate-400">{item.token}</span>
          </Button>
        ))}
        </div>
      </div>
      <div className="flex items-start gap-3">
        <LayoutTemplate className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
        <div className="flex flex-wrap gap-1.5">
        {quickTemplateOptions.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 rounded px-2 text-xs"
            disabled={disabled}
            onClick={() => onApplyQuickTemplate(option.template)}
          >
            {option.label}
          </Button>
        ))}
        </div>
      </div>
    </div>
  );
}
