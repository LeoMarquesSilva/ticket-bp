import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList,
  ChevronRight,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  RequisicaoPessoalFichaCardAttachment,
  MOTIVO_REPOSICAO_LABELS,
  ESCOLARIDADE_LABELS,
  SEXO_LABELS,
  NIVEL_EXIGENCIA_LABELS,
  motivoDescricaoLinha,
  idadeDescricao,
  equipamentosSolicitados,
} from '@/utils/requisicaoPessoalForm';

interface Props {
  payload: RequisicaoPessoalFichaCardAttachment;
  tone: 'own' | 'other';
  onPreviewImage: (url: string) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[minmax(0,140px)_1fr] gap-x-3 gap-y-1 text-sm py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 break-words">{value}</span>
    </div>
  );
}

const RequisicaoPessoalFichaCard: React.FC<Props> = ({ payload, tone, onPreviewImage }) => {
  const [open, setOpen] = useState(false);
  const { data, requester, approvalAttachment } = payload;

  const motivoLabel = data.motivo === 'aumento_quadro' ? 'Aumento de Quadro' : data.motivo === 'reposicao' ? 'Reposição' : '—';
  const equipamentos = equipamentosSolicitados(data);
  const isApprovalImage = approvalAttachment?.type?.startsWith('image/');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-1 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
          tone === 'own'
            ? 'border-white/30 bg-white/10 hover:bg-white/20'
            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
        }`}
      >
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
            tone === 'own' ? 'bg-white/20' : 'bg-[#F69F19]/15'
          }`}
        >
          <ClipboardList className={`h-4.5 w-4.5 ${tone === 'own' ? 'text-white' : 'text-[#F69F19]'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${tone === 'own' ? 'text-white' : 'text-slate-800'}`}>
            Ficha de Requisição de Pessoal
          </p>
          <p className={`text-xs truncate ${tone === 'own' ? 'text-white/80' : 'text-slate-500'}`}>
            {data.cargo.trim()} · {motivoLabel}
          </p>
        </div>
        <ChevronRight className={`h-4 w-4 flex-shrink-0 ${tone === 'own' ? 'text-white/70' : 'text-slate-400'}`} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[#F69F19]" />
              Ficha de Requisição de Pessoal
            </DialogTitle>
            <DialogDescription>
              {requester.name}
              {requester.department ? ` · ${requester.department}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Section title="Motivo da requisição">
              {motivoDescricaoLinha(data).map((line, idx) => {
                const [label, ...rest] = line.split(': ');
                return <Field key={idx} label={label} value={rest.join(': ')} />;
              })}
            </Section>

            <Section title="Requisitos do candidato / cargo">
              <Field label="Cargo" value={data.cargo.trim()} />
              <Field label="Experiência desejada" value={data.experienciaDesejada.trim()} />
              <Field label="Atribuições" value={data.atribuicoes.trim()} />
              <Field label="Perfil desejado" value={data.perfilCargo.trim()} />
              <Field label="Idade" value={idadeDescricao(data)} />
              <Field label="Sexo" value={data.sexo ? SEXO_LABELS[data.sexo] : ''} />
              <Field label="Escolaridade" value={data.escolaridade ? ESCOLARIDADE_LABELS[data.escolaridade] : ''} />
              {data.cursoEspecial.trim() && (
                <Field
                  label="Curso especial"
                  value={`${data.cursoEspecial.trim()} (${
                    data.cursoEspecialNivel ? NIVEL_EXIGENCIA_LABELS[data.cursoEspecialNivel] : 'Indiferente'
                  })`}
                />
              )}
            </Section>

            <Section title="Remuneração">
              <Field label="Sugerida" value={data.remuneracaoSugerida.trim()} />
            </Section>

            <Section title="Licenças | Equipamentos de TI | Suprimentos">
              {equipamentos.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum equipamento ou licença adicional solicitado.</p>
              ) : (
                equipamentos.map((item, idx) => (
                  <Field key={idx} label={item.label} value={`Valor estimado: ${item.valor}`} />
                ))
              )}
            </Section>

            <Section title="Aprovação">
              <div className="flex items-center gap-2 mb-2">
                {data.aprovacaoSocio === 'sim' ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> De acordo do sócio obtido
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
                    <XCircle className="h-3 w-3" /> Ainda sem o de acordo do sócio
                  </Badge>
                )}
              </div>

              {approvalAttachment && (
                isApprovalImage ? (
                  <button
                    type="button"
                    onClick={() => onPreviewImage(approvalAttachment.url)}
                    className="block overflow-hidden rounded-lg border border-slate-200 hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={approvalAttachment.url}
                      alt={approvalAttachment.name}
                      className="max-h-56 w-full object-contain bg-white"
                    />
                    <span className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-600 border-t border-slate-200 bg-slate-50">
                      <ImageIcon className="h-3 w-3" /> {approvalAttachment.name}
                    </span>
                  </button>
                ) : (
                  <a
                    href={approvalAttachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#F69F19] hover:text-[#DE5532] hover:underline"
                  >
                    <FileText className="h-4 w-4" /> {approvalAttachment.name}
                  </a>
                )
              )}
            </Section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RequisicaoPessoalFichaCard;
