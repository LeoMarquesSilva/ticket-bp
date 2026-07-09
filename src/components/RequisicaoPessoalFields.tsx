import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle, Paperclip, X } from 'lucide-react';
import {
  RequisicaoPessoalFormData,
  EquipamentoItem,
  MOTIVO_REPOSICAO_LABELS,
  formatCurrencyBRL,
} from '@/utils/requisicaoPessoalForm';

interface Props {
  data: RequisicaoPessoalFormData;
  onChange: (data: RequisicaoPessoalFormData) => void;
  errors: Record<string, string>;
}

const EQUIPAMENTOS: Array<{ key: keyof Pick<RequisicaoPessoalFormData, 'estacaoTrabalho' | 'notebook' | 'mouseTecladoApoio' | 'licencaMicrosoft' | 'usuarioLegalOne'>; label: string }> = [
  { key: 'estacaoTrabalho', label: 'Estação de trabalho | Cadeira' },
  { key: 'notebook', label: 'Notebook' },
  { key: 'mouseTecladoApoio', label: 'Mouse | Teclado | Apoio' },
  { key: 'licencaMicrosoft', label: 'Licença da Microsoft' },
  { key: 'usuarioLegalOne', label: 'Usuário do Legal One' },
];

/** Input com máscara de moeda (estilo caixa/PDV): os dígitos digitados entram como centavos, sempre lidos da esquerda para a direita a partir do valor completo já digitado — por isso não precisa gerenciar posição de cursor. */
const CurrencyInput: React.FC<{
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ id, value, onValueChange, placeholder, className }) => (
  <Input
    id={id}
    inputMode="numeric"
    value={value}
    onChange={(e) => onValueChange(formatCurrencyBRL(e.target.value))}
    placeholder={placeholder}
    className={className}
  />
);

const RequisicaoPessoalFields: React.FC<Props> = ({ data, onChange, errors }) => {
  const update = (patch: Partial<RequisicaoPessoalFormData>) => {
    onChange({ ...data, ...patch });
  };

  const updateEquipamento = (key: keyof RequisicaoPessoalFormData, patch: Partial<EquipamentoItem>) => {
    const current = data[key] as EquipamentoItem;
    onChange({ ...data, [key]: { ...current, ...patch } });
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="text-[#BD2D29] text-xs flex items-center mt-1">
        <AlertCircle className="h-3 w-3 mr-1" />
        {errors[key]}
      </p>
    ) : null;

  return (
    <div className="space-y-5 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/5 p-4">
      <div>
        <p className="text-sm font-semibold text-[#2C2D2F]">Ficha de Requisição de Pessoal</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Preencha os dados abaixo. Eles serão enviados de forma estruturada no chat do ticket.
        </p>
      </div>

      {/* Motivo da requisição */}
      <div className="space-y-3">
        <Label>Motivo da requisição <span className="text-red-500">*</span></Label>
        <RadioGroup
          value={data.motivo}
          onValueChange={(value: 'aumento_quadro' | 'reposicao') => update({ motivo: value })}
          className="flex flex-wrap gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="aumento_quadro" id="rp-motivo-aumento" />
            <Label htmlFor="rp-motivo-aumento" className="font-normal cursor-pointer">Aumento de Quadro</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="reposicao" id="rp-motivo-reposicao" />
            <Label htmlFor="rp-motivo-reposicao" className="font-normal cursor-pointer">Reposição</Label>
          </div>
        </RadioGroup>
        {fieldError('motivo')}

        {data.motivo === 'aumento_quadro' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <Label htmlFor="rp-justificativa-aumento">Justificativa do aumento de quadro <span className="text-red-500">*</span></Label>
            <Textarea
              id="rp-justificativa-aumento"
              value={data.justificativaAumentoQuadro}
              onChange={(e) => update({ justificativaAumentoQuadro: e.target.value })}
              rows={2}
              className={errors.justificativaAumentoQuadro ? 'border-[#BD2D29]' : ''}
            />
            {fieldError('justificativaAumentoQuadro')}
          </div>
        )}

        {data.motivo === 'reposicao' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="space-y-2">
              <Label>Tipo de reposição <span className="text-red-500">*</span></Label>
              <RadioGroup
                value={data.motivoReposicao}
                onValueChange={(value: RequisicaoPessoalFormData['motivoReposicao']) => update({ motivoReposicao: value })}
                className="flex flex-col gap-2"
              >
                {(Object.entries(MOTIVO_REPOSICAO_LABELS) as [RequisicaoPessoalFormData['motivoReposicao'], string][]).map(([value, label]) => (
                  <div key={value} className="flex items-center space-x-2">
                    <RadioGroupItem value={value} id={`rp-reposicao-${value}`} />
                    <Label htmlFor={`rp-reposicao-${value}`} className="font-normal cursor-pointer">{label}</Label>
                  </div>
                ))}
              </RadioGroup>
              {fieldError('motivoReposicao')}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rp-nome-substituido">Nome do colaborador substituído <span className="text-red-500">*</span></Label>
                <Input
                  id="rp-nome-substituido"
                  value={data.nomeColaboradorSubstituido}
                  onChange={(e) => update({ nomeColaboradorSubstituido: e.target.value })}
                  className={errors.nomeColaboradorSubstituido ? 'border-[#BD2D29]' : ''}
                />
                {fieldError('nomeColaboradorSubstituido')}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rp-cargo-substituido">Cargo do colaborador substituído <span className="text-red-500">*</span></Label>
                <Input
                  id="rp-cargo-substituido"
                  value={data.cargoColaboradorSubstituido}
                  onChange={(e) => update({ cargoColaboradorSubstituido: e.target.value })}
                  className={errors.cargoColaboradorSubstituido ? 'border-[#BD2D29]' : ''}
                />
                {fieldError('cargoColaboradorSubstituido')}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rp-justificativa-reposicao">Justificativa da reposição <span className="text-red-500">*</span></Label>
              <Textarea
                id="rp-justificativa-reposicao"
                value={data.justificativaReposicao}
                onChange={(e) => update({ justificativaReposicao: e.target.value })}
                rows={2}
                className={errors.justificativaReposicao ? 'border-[#BD2D29]' : ''}
              />
              {fieldError('justificativaReposicao')}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[#8B5CF6]/15 pt-4 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Requisitos do candidato / cargo</p>

        <div className="space-y-2">
          <Label htmlFor="rp-cargo">Cargo <span className="text-red-500">*</span></Label>
          <Input
            id="rp-cargo"
            value={data.cargo}
            onChange={(e) => update({ cargo: e.target.value })}
            placeholder="Ex: Advogado Júnior"
            className={errors.cargo ? 'border-[#BD2D29]' : ''}
          />
          {fieldError('cargo')}
        </div>

        <div className="space-y-2">
          <Label htmlFor="rp-experiencia">Experiência desejada</Label>
          <Textarea
            id="rp-experiencia"
            value={data.experienciaDesejada}
            onChange={(e) => update({ experienciaDesejada: e.target.value })}
            placeholder={'Ex: Graduação completa em Direito com OAB ativa;\nExperiência prévia na área de recuperação de créditos cíveis;\nConhecimento sólido em Direito Processual Civil.'}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rp-atribuicoes">Atribuições do cargo (tarefas a serem realizadas)</Label>
          <Textarea
            id="rp-atribuicoes"
            value={data.atribuicoes}
            onChange={(e) => update({ atribuicoes: e.target.value })}
            placeholder={'Ex: Elaboração e acompanhamento de processos;\nNegociação e acordo com devedores;\nRepresentação do escritório em audiências.'}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rp-perfil">Perfil do cargo (características pessoais) desejado</Label>
          <Textarea
            id="rp-perfil"
            value={data.perfilCargo}
            onChange={(e) => update({ perfilCargo: e.target.value })}
            placeholder={'Ex: Proatividade e capacidade de tomar iniciativas;\nExcelente habilidade de comunicação escrita e oral;\nComprometimento com prazos e qualidade do trabalho.'}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Idade <span className="text-red-500">*</span></Label>
          <RadioGroup
            value={data.faixaIdade}
            onValueChange={(value: RequisicaoPessoalFormData['faixaIdade']) => update({ faixaIdade: value })}
            className="flex flex-wrap items-center gap-x-4 gap-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="indiferente" id="rp-idade-indiferente" />
              <Label htmlFor="rp-idade-indiferente" className="font-normal cursor-pointer">Indiferente</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="ate" id="rp-idade-ate" />
              <Label htmlFor="rp-idade-ate" className="font-normal cursor-pointer">Até</Label>
              <Input
                type="number"
                min={1}
                value={data.idadeAte}
                onChange={(e) => update({ idadeAte: e.target.value, faixaIdade: 'ate' })}
                className={`h-8 w-20 ${errors.idadeAte ? 'border-[#BD2D29]' : ''}`}
                placeholder="anos"
              />
            </div>
          </RadioGroup>
          {fieldError('faixaIdade')}
          {fieldError('idadeAte')}
        </div>

        <div className="space-y-2">
          <Label>Sexo <span className="text-red-500">*</span></Label>
          <RadioGroup
            value={data.sexo}
            onValueChange={(value: RequisicaoPessoalFormData['sexo']) => update({ sexo: value })}
            className="flex flex-wrap items-center gap-x-4 gap-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="indiferente" id="rp-sexo-indiferente" />
              <Label htmlFor="rp-sexo-indiferente" className="font-normal cursor-pointer">Indiferente</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="masculino" id="rp-sexo-masculino" />
              <Label htmlFor="rp-sexo-masculino" className="font-normal cursor-pointer">Masculino</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="feminino" id="rp-sexo-feminino" />
              <Label htmlFor="rp-sexo-feminino" className="font-normal cursor-pointer">Feminino</Label>
            </div>
          </RadioGroup>
          {fieldError('sexo')}
        </div>

        <div className="space-y-2">
          <Label>Escolaridade <span className="text-red-500">*</span></Label>
          <RadioGroup
            value={data.escolaridade}
            onValueChange={(value: RequisicaoPessoalFormData['escolaridade']) => update({ escolaridade: value })}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ensino_medio" id="rp-esc-medio" />
              <Label htmlFor="rp-esc-medio" className="font-normal cursor-pointer">Ensino Médio</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="graduacao" id="rp-esc-graduacao" />
              <Label htmlFor="rp-esc-graduacao" className="font-normal cursor-pointer">Graduação</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pos_graduacao" id="rp-esc-pos" />
              <Label htmlFor="rp-esc-pos" className="font-normal cursor-pointer">Pós-Graduação</Label>
            </div>
          </RadioGroup>
          {fieldError('escolaridade')}
        </div>

        <div className="space-y-2">
          <Label htmlFor="rp-curso-especial">Curso especial (especialização, mestrado)</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              id="rp-curso-especial"
              value={data.cursoEspecial}
              onChange={(e) => update({ cursoEspecial: e.target.value })}
              placeholder="Opcional"
              className="max-w-xs"
            />
            {data.cursoEspecial.trim() && (
              <RadioGroup
                value={data.cursoEspecialNivel}
                onValueChange={(value: RequisicaoPessoalFormData['cursoEspecialNivel']) => update({ cursoEspecialNivel: value })}
                className="flex items-center gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="desejavel" id="rp-nivel-desejavel" />
                  <Label htmlFor="rp-nivel-desejavel" className="font-normal cursor-pointer text-sm">Desejável</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="imprescindivel" id="rp-nivel-imprescindivel" />
                  <Label htmlFor="rp-nivel-imprescindivel" className="font-normal cursor-pointer text-sm">Imprescindível</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="indiferente" id="rp-nivel-indiferente" />
                  <Label htmlFor="rp-nivel-indiferente" className="font-normal cursor-pointer text-sm">Indiferente</Label>
                </div>
              </RadioGroup>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[#8B5CF6]/15 pt-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Remuneração</p>
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="rp-remuneracao">Remuneração sugerida <span className="text-red-500">*</span></Label>
          <CurrencyInput
            id="rp-remuneracao"
            value={data.remuneracaoSugerida}
            onValueChange={(value) => update({ remuneracaoSugerida: value })}
            placeholder="R$ 0,00"
            className={errors.remuneracaoSugerida ? 'border-[#BD2D29]' : ''}
          />
          {fieldError('remuneracaoSugerida')}
        </div>
      </div>

      <div className="border-t border-[#8B5CF6]/15 pt-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Licenças | Equipamentos de TI | Suprimentos</p>
        {EQUIPAMENTOS.map(({ key, label }) => {
          const item = data[key] as EquipamentoItem;
          return (
            <div key={key} className="flex flex-wrap items-center gap-3 rounded-md bg-white/60 border border-[#8B5CF6]/10 p-2.5">
              <span className="flex-1 min-w-[180px] text-sm text-[#2C2D2F]">{label}</span>
              <RadioGroup
                value={item.necessario}
                onValueChange={(value: 'sim' | 'nao') => updateEquipamento(key, { necessario: value, valor: value === 'nao' ? '' : item.valor })}
                className="flex items-center gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id={`rp-${key}-sim`} />
                  <Label htmlFor={`rp-${key}-sim`} className="font-normal cursor-pointer text-sm">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id={`rp-${key}-nao`} />
                  <Label htmlFor={`rp-${key}-nao`} className="font-normal cursor-pointer text-sm">Não</Label>
                </div>
              </RadioGroup>
              {item.necessario === 'sim' && (
                <CurrencyInput
                  value={item.valor}
                  onValueChange={(value) => updateEquipamento(key, { valor: value })}
                  placeholder="R$ 0,00"
                  className={`h-8 w-32 ${errors[`${key}Valor`] ? 'border-[#BD2D29]' : ''}`}
                />
              )}
              {fieldError(key)}
              {fieldError(`${key}Valor`)}
            </div>
          );
        })}
      </div>

      <div className="border-t border-[#8B5CF6]/15 pt-4 space-y-2">
        <Label>Já obteve o "de acordo" do sócio? <span className="text-red-500">*</span></Label>
        <RadioGroup
          value={data.aprovacaoSocio}
          onValueChange={(value: 'sim' | 'nao') => update({ aprovacaoSocio: value, anexoAprovacao: value === 'nao' ? null : data.anexoAprovacao })}
          className="flex gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="sim" id="rp-aprovacao-sim" />
            <Label htmlFor="rp-aprovacao-sim" className="font-normal cursor-pointer">Sim</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="nao" id="rp-aprovacao-nao" />
            <Label htmlFor="rp-aprovacao-nao" className="font-normal cursor-pointer">Não</Label>
          </div>
        </RadioGroup>
        {fieldError('aprovacaoSocio')}

        {data.aprovacaoSocio === 'sim' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <Label>Anexar print/comprovante do "de acordo" <span className="text-red-500">*</span></Label>
            {data.anexoAprovacao ? (
              <div className="flex items-center gap-2 rounded-md border border-[#8B5CF6]/20 bg-white px-3 py-2 text-sm text-[#2C2D2F] w-fit">
                <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="truncate max-w-[220px]">{data.anexoAprovacao.name}</span>
                <button
                  type="button"
                  onClick={() => update({ anexoAprovacao: null })}
                  className="text-slate-400 hover:text-[#BD2D29] transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => update({ anexoAprovacao: e.target.files?.[0] ?? null })}
                className={errors.anexoAprovacao ? 'border-[#BD2D29]' : ''}
              />
            )}
            {fieldError('anexoAprovacao')}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequisicaoPessoalFields;
