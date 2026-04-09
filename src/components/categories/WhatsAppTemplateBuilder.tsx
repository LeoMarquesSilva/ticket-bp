import { Button } from '@/components/ui/button';

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
    <div className="space-y-2 rounded-md border border-slate-200 bg-white/60 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600">Variáveis rápidas:</span>
        {whatsappTemplateVariables.map((item) => (
          <Button
            key={item.token}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={disabled}
            onClick={() => onInsertVariable(item.token)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600">Modelos rápidos:</span>
        {quickTemplateOptions.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={disabled}
            onClick={() => onApplyQuickTemplate(option.template)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
