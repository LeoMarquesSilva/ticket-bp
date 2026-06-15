import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Info, Loader2 } from 'lucide-react';
import UserAssigneePicker from '@/components/UserAssigneePicker';
import { DatePickerBr } from '@/components/ui/date-picker-br';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DesenvolvimentoContinuoFormData,
} from '@/utils/desenvolvimentoContinuoForm';
import { getRoleLabel } from '@/hooks/useDesenvolvimentoContinuoOptions';
import type { Department } from '@/services/departmentService';
import type { User } from '@/types';

interface Props {
  data: DesenvolvimentoContinuoFormData;
  onChange: (data: DesenvolvimentoContinuoFormData) => void;
  errors: Record<string, string>;
  users: User[];
  departments: Department[];
  loading?: boolean;
}

const DesenvolvimentoContinuoFields: React.FC<Props> = ({
  data,
  onChange,
  errors,
  users,
  departments,
  loading = false,
}) => {
  const update = (patch: Partial<DesenvolvimentoContinuoFormData>) => {
    onChange({ ...data, ...patch });
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="text-[#BD2D29] text-xs flex items-center mt-1">
        <AlertCircle className="h-3 w-3 mr-1" />
        {errors[key]}
      </p>
    ) : null;

  return (
    <div className="space-y-4 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/5 p-4">
      <div>
        <p className="text-sm font-semibold text-[#2C2D2F]">Informações do evento</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Preencha os dados abaixo. Eles serão enviados de forma estruturada no chat do ticket.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando usuários e áreas...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Responsável (Gerente da área) <span className="text-red-500">*</span></Label>
          <UserAssigneePicker
            value={data.responsavelUserId || undefined}
            onChange={(userId) => update({ responsavelUserId: userId ?? '' })}
            users={users}
            getRoleLabel={getRoleLabel}
            noneLabel="Selecione o responsável"
            allowNone={false}
            disabled={loading}
            className={errors.responsavelUserId ? 'border-[#BD2D29]' : ''}
          />
          {fieldError('responsavelUserId')}
        </div>

        <div className="space-y-2">
          <Label>Facilitador <span className="text-red-500">*</span></Label>
          <UserAssigneePicker
            value={data.facilitadorUserId || undefined}
            onChange={(userId) => update({ facilitadorUserId: userId ?? '' })}
            users={users}
            getRoleLabel={getRoleLabel}
            noneLabel="Selecione o facilitador"
            allowNone={false}
            disabled={loading}
            className={errors.facilitadorUserId ? 'border-[#BD2D29]' : ''}
          />
          {fieldError('facilitadorUserId')}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="dc-tema">Tema <span className="text-red-500">*</span></Label>
          <Input
            id="dc-tema"
            value={data.tema}
            onChange={(e) => update({ tema: e.target.value })}
            placeholder="Tema do treinamento ou workshop"
            className={errors.tema ? 'border-[#BD2D29]' : ''}
          />
          {fieldError('tema')}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dc-data">Data da realização <span className="text-red-500">*</span></Label>
          <DatePickerBr
            id="dc-data"
            value={data.dataRealizacao}
            onChange={(value) => update({ dataRealizacao: value })}
            placeholder="Selecione a data"
            disabled={loading}
            className={errors.dataRealizacao ? 'border-[#BD2D29]' : ''}
          />
          {fieldError('dataRealizacao')}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dc-duracao">Duração (minutos) <span className="text-red-500">*</span></Label>
          <Input
            id="dc-duracao"
            type="number"
            min={1}
            value={data.duracaoMinutos}
            onChange={(e) => update({ duracaoMinutos: e.target.value })}
            placeholder="Ex: 60"
            className={errors.duracaoMinutos ? 'border-[#BD2D29]' : ''}
          />
          {fieldError('duracaoMinutos')}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Área <span className="text-red-500">*</span></Label>
          <Select
            value={data.area}
            onValueChange={(value) => update({ area: value })}
            disabled={loading || departments.length === 0}
          >
            <SelectTrigger className={errors.area ? 'border-[#BD2D29]' : ''}>
              <SelectValue placeholder="Selecione a área" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.name}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError('area')}
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-1.5">
          <Label>Precisa de ajuste em PPT? <span className="text-red-500">*</span></Label>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex text-slate-400 hover:text-[#F69F19] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19]/30 rounded-full"
                  aria-label="Orientações sobre o envio do PPT"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="start"
                className="max-w-[280px] bg-[#2C2D2F] text-white border border-[#F69F19]/20 px-3 py-2.5 text-xs leading-relaxed"
              >
                <p>
                  Se precisar de ajuste, envie o link de um PPT que já contenha as informações
                  do treinamento: <strong>título</strong> e <strong>textos do conteúdo</strong> dentro
                  dos slides. Com isso, o Marketing ajusta somente o design da apresentação.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <RadioGroup
          value={data.precisaAjustePpt}
          onValueChange={(value: 'sim' | 'nao') =>
            update({
              precisaAjustePpt: value,
              linkPpt: value === 'nao' ? '' : data.linkPpt,
            })
          }
          className="flex gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="sim" id="dc-ppt-sim" />
            <Label htmlFor="dc-ppt-sim" className="font-normal cursor-pointer">Sim</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="nao" id="dc-ppt-nao" />
            <Label htmlFor="dc-ppt-nao" className="font-normal cursor-pointer">Não</Label>
          </div>
        </RadioGroup>
        {fieldError('precisaAjustePpt')}

        {data.precisaAjustePpt === 'sim' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <Label htmlFor="dc-link-ppt">Link do PPT <span className="text-red-500">*</span></Label>
            <Input
              id="dc-link-ppt"
              type="url"
              value={data.linkPpt}
              onChange={(e) => update({ linkPpt: e.target.value })}
              placeholder="https://..."
              className={errors.linkPpt ? 'border-[#BD2D29]' : ''}
            />
            <p className="text-xs text-slate-500">
              O PPT deve incluir título e textos do treinamento; o link é usado para o ajuste visual.
            </p>
            {fieldError('linkPpt')}
          </div>
        )}
      </div>
    </div>
  );
};

export default DesenvolvimentoContinuoFields;
