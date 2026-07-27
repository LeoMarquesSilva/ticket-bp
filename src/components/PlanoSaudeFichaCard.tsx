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
  HeartPulse,
  ChevronRight,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import {
  PlanoSaudeFichaCardAttachment,
  PlanoSaudeFileAttachment,
  VINCULO_EMPRESA_LABELS,
  formatDateBR,
  vinculoDependenteLabel,
} from '@/utils/planoSaudeForm';
import { getAttachmentDownloadUrl } from '@/utils/attachmentDownload';

interface Props {
  payload: PlanoSaudeFichaCardAttachment;
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

function AttachmentLink({
  attachment,
  label,
  onPreviewImage,
}: {
  attachment: PlanoSaudeFileAttachment | null;
  label: string;
  onPreviewImage: (url: string) => void;
}) {
  if (!attachment) return null;
  const isImage = attachment.type?.startsWith('image/');

  if (isImage) {
    return (
      <button
        type="button"
        onClick={() => onPreviewImage(attachment.url)}
        className="block w-full overflow-hidden rounded-lg border border-slate-200 hover:opacity-90 transition-opacity text-left"
      >
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-h-40 w-full object-contain bg-white"
        />
        <span className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-600 border-t border-slate-200 bg-slate-50">
          <ImageIcon className="h-3 w-3" /> {label}: {attachment.name}
        </span>
      </button>
    );
  }

  return (
    <a
      href={getAttachmentDownloadUrl(attachment.url, attachment.name)}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#F69F19] hover:text-[#DE5532] hover:underline"
    >
      <FileText className="h-4 w-4" /> {label}: {attachment.name}
    </a>
  );
}

const PlanoSaudeFichaCard: React.FC<Props> = ({ payload, tone, onPreviewImage }) => {
  const [open, setOpen] = useState(false);
  const { data, requester } = payload;

  const depsCount = data.dependentes?.length ?? 0;
  const vinculoLabel = data.vinculoEmpresa ? VINCULO_EMPRESA_LABELS[data.vinculoEmpresa] : '—';

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
          <HeartPulse className={`h-4.5 w-4.5 ${tone === 'own' ? 'text-white' : 'text-[#F69F19]'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${tone === 'own' ? 'text-white' : 'text-slate-800'}`}>
            Inclusão no Plano de Saúde
          </p>
          <p className={`text-xs truncate ${tone === 'own' ? 'text-white/80' : 'text-slate-500'}`}>
            {data.nomeCompleto.trim()}
            {depsCount > 0 ? ` · ${depsCount} dependente${depsCount > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <ChevronRight className={`h-4 w-4 flex-shrink-0 ${tone === 'own' ? 'text-white/70' : 'text-slate-400'}`} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-[#F69F19]" />
              Inclusão no Plano de Saúde
            </DialogTitle>
            <DialogDescription>
              {requester.name}
              {requester.department ? ` · ${requester.department}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Sem subsídio do escritório. Adesão apenas para sócios de serviços (Contrato Social) e
            colaboradores CLT.
          </div>

          <div className="space-y-4">
            <Section title="Dados do titular">
              <Field label="Nome completo" value={data.nomeCompleto.trim()} />
              <Field label="Nascimento" value={formatDateBR(data.dataNascimento)} />
              <Field label="Vínculo" value={vinculoLabel} />
              <Field label="E-mail" value={data.email.trim()} />
              <Field label="Telefone" value={data.telefone.trim()} />
              <div className="mt-3 space-y-2">
                <AttachmentLink
                  attachment={data.documentoIdentidade}
                  label="RG/CNH"
                  onPreviewImage={onPreviewImage}
                />
                <AttachmentLink
                  attachment={data.comprovanteEndereco}
                  label="Comprovante"
                  onPreviewImage={onPreviewImage}
                />
              </div>
            </Section>

            <Section title="Dependentes">
              {depsCount === 0 ? (
                <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                  Sem dependentes
                </Badge>
              ) : (
                <div className="space-y-4">
                  {data.dependentes.map((dep, index) => (
                    <div key={dep.id || index} className="space-y-2 border-t border-slate-200 pt-3 first:border-0 first:pt-0">
                      <p className="text-sm font-medium text-slate-800">
                        Dependente {index + 1}: {dep.nomeCompleto.trim()}
                      </p>
                      <Field label="Nascimento" value={formatDateBR(dep.dataNascimento)} />
                      <Field label="Vínculo" value={vinculoDependenteLabel(dep)} />
                      <Field label="E-mail" value={dep.email.trim()} />
                      <Field label="Telefone" value={dep.telefone.trim()} />
                      <div className="space-y-2 pt-1">
                        <AttachmentLink
                          attachment={dep.documentoIdentidade}
                          label="Documento"
                          onPreviewImage={onPreviewImage}
                        />
                        <AttachmentLink
                          attachment={dep.comprovanteEndereco}
                          label="Comprovante"
                          onPreviewImage={onPreviewImage}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PlanoSaudeFichaCard;
