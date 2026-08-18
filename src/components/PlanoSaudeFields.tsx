import React, { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle, AlertTriangle, Paperclip, Plus, Trash2, X } from 'lucide-react';
import {
  PlanoSaudeFormData,
  PlanoSaudeDependenteFormData,
  VINCULO_EMPRESA_LABELS,
  VINCULO_DEPENDENTE_LABELS,
  createEmptyDependente,
  formatTelefoneBR,
} from '@/utils/planoSaudeForm';
import { DatePickerBr } from '@/components/ui/date-picker-br';

interface Props {
  data: PlanoSaudeFormData;
  onChange: (data: PlanoSaudeFormData) => void;
  errors: Record<string, string>;
}

const FileField: React.FC<{
  id: string;
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  error?: string;
  hint?: string;
}> = ({ id, label, file, onFileChange, error, hint }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} <span className="text-red-500">*</span>
      </Label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*,.pdf"
        className="sr-only"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-2 rounded-md border border-[#8B5CF6]/20 bg-white px-3 py-2 text-sm text-[#2C2D2F] w-fit max-w-full">
          <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="truncate max-w-[220px]">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              onFileChange(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="text-slate-400 hover:text-[#BD2D29] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className={`w-full justify-start gap-2 font-normal text-slate-600 ${
            error ? 'border-[#BD2D29]' : 'border-slate-300'
          }`}
        >
          <Paperclip className="h-4 w-4 text-slate-400" />
          Escolher arquivo
        </Button>
      )}
      {error && (
        <p className="text-[#BD2D29] text-xs flex items-center mt-1">
          <AlertCircle className="h-3 w-3 mr-1" />
          {error}
        </p>
      )}
    </div>
  );
};

const PlanoSaudeFields: React.FC<Props> = ({ data, onChange, errors }) => {
  const update = (patch: Partial<PlanoSaudeFormData>) => {
    onChange({ ...data, ...patch });
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="text-[#BD2D29] text-xs flex items-center mt-1">
        <AlertCircle className="h-3 w-3 mr-1" />
        {errors[key]}
      </p>
    ) : null;

  const updateDependente = (index: number, patch: Partial<PlanoSaudeDependenteFormData>) => {
    const dependentes = data.dependentes.map((dep, i) =>
      i === index ? { ...dep, ...patch } : dep,
    );
    update({ dependentes });
  };

  const addDependente = () => {
    update({ dependentes: [...data.dependentes, createEmptyDependente()] });
  };

  const removeDependente = (index: number) => {
    update({ dependentes: data.dependentes.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-5 rounded-lg border border-[#8B5CF6]/25 bg-[#8B5CF6]/5 p-4">
      <div>
        <p className="text-sm font-semibold text-[#2C2D2F]">Inclusão no Plano de Saúde</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Preencha os dados para solicitação de cotação. Eles serão enviados de forma estruturada no
          chat do ticket.
        </p>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900 space-y-1">
          <p className="font-semibold">Aviso importante</p>
          <p>
            O escritório <strong>não concede subsídio</strong> para o plano de saúde. A adesão está
            disponível exclusivamente para <strong>sócios de serviços</strong> vinculados ao Contrato
            Social e <strong>colaboradores contratados sob o regime CLT</strong>.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Dados do titular
        </p>

        <div className="space-y-2">
          <Label htmlFor="ps-nome">
            Nome completo <span className="text-red-500">*</span>
          </Label>
          <Input
            id="ps-nome"
            value={data.nomeCompleto}
            onChange={(e) => update({ nomeCompleto: e.target.value })}
            className={errors.nomeCompleto ? 'border-[#BD2D29]' : ''}
          />
          {fieldError('nomeCompleto')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ps-nascimento">
              Data de nascimento <span className="text-red-500">*</span>
            </Label>
            <DatePickerBr
              id="ps-nascimento"
              value={data.dataNascimento}
              onChange={(value) => update({ dataNascimento: value })}
              placeholder="DD/MM/AAAA"
              label="Data de nascimento"
              fromYear={1926}
              disableFuture
              className={errors.dataNascimento ? 'border-[#BD2D29]' : ''}
            />
            {fieldError('dataNascimento')}
          </div>

          <div className="space-y-2">
            <Label>
              Vínculo com a empresa <span className="text-red-500">*</span>
            </Label>
            <RadioGroup
              value={data.vinculoEmpresa}
              onValueChange={(value: 'socio_servicos' | 'clt') => update({ vinculoEmpresa: value })}
              className="flex flex-col gap-2 pt-1"
            >
              {(Object.entries(VINCULO_EMPRESA_LABELS) as [Exclude<typeof data.vinculoEmpresa, ''>, string][]).map(
                ([value, label]) => (
                  <div key={value} className="flex items-center space-x-2">
                    <RadioGroupItem value={value} id={`ps-vinculo-${value}`} />
                    <Label htmlFor={`ps-vinculo-${value}`} className="font-normal cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ),
              )}
            </RadioGroup>
            {fieldError('vinculoEmpresa')}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ps-email">
              E-mail <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ps-email"
              type="email"
              value={data.email}
              onChange={(e) => update({ email: e.target.value })}
              className={errors.email ? 'border-[#BD2D29]' : ''}
            />
            {fieldError('email')}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ps-telefone">
              Telefone de contato <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ps-telefone"
              inputMode="tel"
              value={data.telefone}
              onChange={(e) => update({ telefone: formatTelefoneBR(e.target.value) })}
              placeholder="(11) 98765-4321"
              className={errors.telefone ? 'border-[#BD2D29]' : ''}
            />
            {fieldError('telefone')}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FileField
            id="ps-documento"
            label="Cópia do RG ou CNH"
            file={data.documentoIdentidade}
            onFileChange={(file) => update({ documentoIdentidade: file })}
            error={errors.documentoIdentidade}
          />
          <FileField
            id="ps-comprovante"
            label="Comprovante de endereço"
            file={data.comprovanteEndereco}
            onFileChange={(file) => update({ comprovanteEndereco: file })}
            error={errors.comprovanteEndereco}
          />
        </div>
      </div>

      <div className="border-t border-[#8B5CF6]/15 pt-4 space-y-3">
        <Label>
          Incluir dependentes? <span className="text-red-500">*</span>
        </Label>
        <RadioGroup
          value={data.incluirDependentes}
          onValueChange={(value: 'sim' | 'nao') =>
            update({
              incluirDependentes: value,
              dependentes:
                value === 'sim'
                  ? data.dependentes.length > 0
                    ? data.dependentes
                    : [createEmptyDependente()]
                  : [],
            })
          }
          className="flex gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="sim" id="ps-deps-sim" />
            <Label htmlFor="ps-deps-sim" className="font-normal cursor-pointer">
              Sim
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="nao" id="ps-deps-nao" />
            <Label htmlFor="ps-deps-nao" className="font-normal cursor-pointer">
              Não
            </Label>
          </div>
        </RadioGroup>
        {fieldError('incluirDependentes')}
        {fieldError('dependentes')}

        {data.incluirDependentes === 'sim' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            {data.dependentes.map((dep, index) => {
              const prefix = `dep_${index}_`;
              return (
                <div
                  key={dep.id}
                  className="rounded-lg border border-[#8B5CF6]/20 bg-white p-4 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#2C2D2F]">Dependente {index + 1}</p>
                    {data.dependentes.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDependente(index)}
                        className="text-slate-500 hover:text-[#BD2D29] h-8 px-2"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remover
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`ps-dep-nome-${index}`}>
                      Nome completo <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={`ps-dep-nome-${index}`}
                      value={dep.nomeCompleto}
                      onChange={(e) => updateDependente(index, { nomeCompleto: e.target.value })}
                      className={errors[`${prefix}nomeCompleto`] ? 'border-[#BD2D29]' : ''}
                    />
                    {fieldError(`${prefix}nomeCompleto`)}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`ps-dep-nasc-${index}`}>
                        Data de nascimento <span className="text-red-500">*</span>
                      </Label>
                      <DatePickerBr
                        id={`ps-dep-nasc-${index}`}
                        value={dep.dataNascimento}
                        onChange={(value) =>
                          updateDependente(index, { dataNascimento: value })
                        }
                        placeholder="DD/MM/AAAA"
                        label="Data de nascimento"
                        fromYear={1926}
                        disableFuture
                        className={errors[`${prefix}dataNascimento`] ? 'border-[#BD2D29]' : ''}
                      />
                      {fieldError(`${prefix}dataNascimento`)}
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Vínculo com o titular <span className="text-red-500">*</span>
                      </Label>
                      <RadioGroup
                        value={dep.vinculoComTitular}
                        onValueChange={(value: PlanoSaudeDependenteFormData['vinculoComTitular']) =>
                          updateDependente(index, {
                            vinculoComTitular: value,
                            vinculoOutro: value === 'outro' ? dep.vinculoOutro : '',
                          })
                        }
                        className="flex flex-col gap-2 pt-1"
                      >
                        {(
                          Object.entries(VINCULO_DEPENDENTE_LABELS) as [
                            Exclude<PlanoSaudeDependenteFormData['vinculoComTitular'], ''>,
                            string,
                          ][]
                        ).map(([value, label]) => (
                          <div key={value} className="flex items-center space-x-2">
                            <RadioGroupItem value={value} id={`ps-dep-vinculo-${index}-${value}`} />
                            <Label
                              htmlFor={`ps-dep-vinculo-${index}-${value}`}
                              className="font-normal cursor-pointer"
                            >
                              {label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {fieldError(`${prefix}vinculoComTitular`)}
                      {dep.vinculoComTitular === 'outro' && (
                        <div className="space-y-2 pt-1">
                          <Input
                            placeholder="Descreva o vínculo"
                            value={dep.vinculoOutro}
                            onChange={(e) =>
                              updateDependente(index, { vinculoOutro: e.target.value })
                            }
                            className={errors[`${prefix}vinculoOutro`] ? 'border-[#BD2D29]' : ''}
                          />
                          {fieldError(`${prefix}vinculoOutro`)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`ps-dep-email-${index}`}>
                        E-mail <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`ps-dep-email-${index}`}
                        type="email"
                        value={dep.email}
                        onChange={(e) => updateDependente(index, { email: e.target.value })}
                        className={errors[`${prefix}email`] ? 'border-[#BD2D29]' : ''}
                      />
                      {fieldError(`${prefix}email`)}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`ps-dep-tel-${index}`}>
                        Telefone <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`ps-dep-tel-${index}`}
                        inputMode="tel"
                        value={dep.telefone}
                        onChange={(e) =>
                          updateDependente(index, { telefone: formatTelefoneBR(e.target.value) })
                        }
                        placeholder="(11) 98765-4321"
                        className={errors[`${prefix}telefone`] ? 'border-[#BD2D29]' : ''}
                      />
                      {fieldError(`${prefix}telefone`)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FileField
                      id={`ps-dep-doc-${index}`}
                      label="Documento de identificação"
                      hint="Certidão de casamento/nascimento, RG ou CNH"
                      file={dep.documentoIdentidade}
                      onFileChange={(file) =>
                        updateDependente(index, { documentoIdentidade: file })
                      }
                      error={errors[`${prefix}documentoIdentidade`]}
                    />
                    <FileField
                      id={`ps-dep-comp-${index}`}
                      label="Comprovante de endereço"
                      file={dep.comprovanteEndereco}
                      onFileChange={(file) =>
                        updateDependente(index, { comprovanteEndereco: file })
                      }
                      error={errors[`${prefix}comprovanteEndereco`]}
                    />
                  </div>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDependente}
              className="border-[#8B5CF6]/40 text-[#8B5CF6] hover:bg-[#8B5CF6]/10"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar dependente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanoSaudeFields;
