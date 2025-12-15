import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, ThumbsUp, MessageSquare, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface NPSModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    requestFulfilled: boolean;
    notFulfilledReason?: string;
    serviceScore: number;
    comment: string;
  }) => void;
  ticketTitle: string;
  mandatory?: boolean; // Nova prop para indicar se o feedback é obrigatório
}

const NPSModal: React.FC<NPSModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  ticketTitle, 
  mandatory = true // Por padrão, o feedback será obrigatório
}) => {
  const [step, setStep] = useState<'request' | 'score' | 'comment'>('request');
  const [requestFulfilled, setRequestFulfilled] = useState<boolean | null>(null);
  const [notFulfilledReason, setNotFulfilledReason] = useState('');
  const [serviceScore, setServiceScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<{
    requestFulfilled?: boolean;
    notFulfilledReason?: boolean;
    serviceScore?: boolean;
    comment?: boolean;
  }>({});
  const [showMandatoryWarning, setShowMandatoryWarning] = useState(false);

  // Constantes para validação de comentário
  const MIN_COMMENT_LENGTH = 10; // Mínimo de 10 caracteres

  // Função para verificar se o comentário é obrigatório
  const isCommentRequired = () => {
    return serviceScore !== null && serviceScore < 7;
  };

  // Função para validar o comprimento do comentário
  const validateCommentLength = (text: string) => {
    return text.trim().length >= MIN_COMMENT_LENGTH;
  };

  // Função para obter mensagem de erro do comentário
  const getCommentErrorMessage = () => {
    const trimmedComment = comment.trim();
    if (!trimmedComment && isCommentRequired()) {
      return 'Por favor, deixe um comentário sobre o atendimento para nos ajudar a melhorar';
    }
    if (trimmedComment && !validateCommentLength(trimmedComment)) {
      return `O comentário deve ter pelo menos ${MIN_COMMENT_LENGTH} caracteres (atual: ${trimmedComment.length})`;
    }
    return null;
  };

  const handleRequestStep = () => {
    if (requestFulfilled === null) {
      setErrors(prev => ({ ...prev, requestFulfilled: true }));
      return;
    }

    if (requestFulfilled === false && !notFulfilledReason.trim()) {
      setErrors(prev => ({ ...prev, notFulfilledReason: true }));
      return;
    }

    // Validar comprimento mínimo da razão quando não foi atendida
    if (requestFulfilled === false && notFulfilledReason.trim().length < MIN_COMMENT_LENGTH) {
      setErrors(prev => ({ ...prev, notFulfilledReason: true }));
      return;
    }

    setErrors({});
    setStep('score');
  };

  const handleScoreStep = () => {
    if (serviceScore === null) {
      setErrors(prev => ({ ...prev, serviceScore: true }));
      return;
    }

    setErrors({});
    setStep('comment');
  };

  const handleSubmit = () => {
    const trimmedComment = comment.trim();
    
    // Validar comentário se for obrigatório (nota < 7)
    if (isCommentRequired()) {
      if (!trimmedComment) {
        setErrors(prev => ({ ...prev, comment: true }));
        return;
      }
      if (!validateCommentLength(trimmedComment)) {
        setErrors(prev => ({ ...prev, comment: true }));
        return;
      }
    }

    // Se comentário foi fornecido (mesmo sendo opcional), validar comprimento
    if (trimmedComment && !validateCommentLength(trimmedComment)) {
      setErrors(prev => ({ ...prev, comment: true }));
      return;
    }

    if (requestFulfilled !== null && serviceScore !== null) {
      onSubmit({
        requestFulfilled,
        notFulfilledReason: !requestFulfilled ? notFulfilledReason.trim() : undefined,
        serviceScore,
        comment: trimmedComment
      });
      resetForm();
    }
  };

  const resetForm = () => {
    setRequestFulfilled(null);
    setNotFulfilledReason('');
    setServiceScore(null);
    setComment('');
    setStep('request');
    setErrors({});
    setShowMandatoryWarning(false);
  };

  const handleClose = () => {
    if (mandatory) {
      // Se for obrigatório, mostrar aviso e não fechar o modal
      setShowMandatoryWarning(true);
      return;
    }
    
    resetForm();
    onClose();
  };

  const getScoreColor = (scoreValue: number) => {
    if (scoreValue <= 6) return 'text-red-500';
    if (scoreValue <= 8) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getScoreLabel = (scoreValue: number) => {
    if (scoreValue <= 6) return 'Insatisfeito';
    if (scoreValue <= 8) return 'Satisfeito';
    return 'Muito Satisfeito';
  };

  // Função para obter mensagem de erro da razão de não atendimento
  const getNotFulfilledReasonError = () => {
    const trimmedReason = notFulfilledReason.trim();
    if (!trimmedReason) {
      return 'Por favor, explique por que sua solicitação não foi atendida';
    }
    if (trimmedReason.length < MIN_COMMENT_LENGTH) {
      return `A explicação deve ter pelo menos ${MIN_COMMENT_LENGTH} caracteres (atual: ${trimmedReason.length})`;
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={mandatory ? () => setShowMandatoryWarning(true) : onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#101F2E]">
            <ThumbsUp className="h-5 w-5 text-[#D5B170]" />
            Avalie Nosso Atendimento
          </DialogTitle>
        </DialogHeader>

        {showMandatoryWarning && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700">
              O preenchimento deste feedback é obrigatório para continuar usando o sistema. 
              Você não poderá criar novos tickets até que avalie este atendimento.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-slate-600 mb-2">
              Ticket finalizado: <span className="font-medium text-[#101F2E]">{ticketTitle}</span>
            </p>
            <p className="text-xs text-slate-500">
              Sua opinião nos ajuda a melhorar nosso atendimento
            </p>
            {mandatory && (
              <p className="text-xs text-red-500 font-medium mt-1">
                * Avaliação obrigatória
              </p>
            )}
          </div>

          {step === 'request' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[#101F2E] flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-[#D5B170]" />
                  Sua solicitação foi atendida?
                </Label>
                
                <RadioGroup 
                  value={requestFulfilled === null ? undefined : requestFulfilled ? 'yes' : 'no'}
                  onValueChange={(value) => {
                    setRequestFulfilled(value === 'yes');
                    setErrors(prev => ({ ...prev, requestFulfilled: false }));
                    setShowMandatoryWarning(false);
                  }}
                  className="flex flex-col space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="yes" />
                    <Label htmlFor="yes" className="cursor-pointer">Sim</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="no" />
                    <Label htmlFor="no" className="cursor-pointer">Não</Label>
                  </div>
                </RadioGroup>
                
                {errors.requestFulfilled && (
                  <p className="text-xs text-red-500 mt-1">
                    Por favor, selecione uma opção
                  </p>
                )}
              </div>

              {requestFulfilled === false && (
                <div className="space-y-2">
                  <Label htmlFor="notFulfilledReason" className="text-sm font-medium text-[#101F2E] flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Por que sua solicitação não foi atendida?
                  </Label>
                  <Textarea
                    id="notFulfilledReason"
                    value={notFulfilledReason}
                    onChange={(e) => {
                      setNotFulfilledReason(e.target.value);
                      if (e.target.value.trim() && e.target.value.trim().length >= MIN_COMMENT_LENGTH) {
                        setErrors(prev => ({ ...prev, notFulfilledReason: false }));
                      }
                      setShowMandatoryWarning(false);
                    }}
                    placeholder={`Explique por que sua solicitação não foi atendida... (mínimo ${MIN_COMMENT_LENGTH} caracteres)`}
                    className={`min-h-[80px] border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170] ${
                      errors.notFulfilledReason ? 'border-red-500' : ''
                    }`}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">
                      {notFulfilledReason.trim().length}/{MIN_COMMENT_LENGTH} caracteres mínimos
                    </span>
                    {notFulfilledReason.trim().length > 0 && notFulfilledReason.trim().length < MIN_COMMENT_LENGTH && (
                      <span className="text-xs text-amber-600">
                        Faltam {MIN_COMMENT_LENGTH - notFulfilledReason.trim().length} caracteres
                      </span>
                    )}
                  </div>
                  {errors.notFulfilledReason && (
                    <p className="text-xs text-red-500">
                      {getNotFulfilledReasonError()}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-between">
                {!mandatory && (
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="border-slate-300 text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </Button>
                )}
                <Button
                  onClick={handleRequestStep}
                  className={`${!mandatory ? '' : 'w-full'} bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white`}
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {step === 'score' && (
            <div className="space-y-4">
              <div className="text-center">
                <Label className="text-sm font-medium text-[#101F2E]">
                  Como você avalia a cordialidade e o profissionalismo do atendimento?
                </Label>
              </div>

              <div className="grid grid-cols-11 gap-1">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setServiceScore(i);
                      setErrors(prev => ({ ...prev, serviceScore: false }));
                      setShowMandatoryWarning(false);
                    }}
                    className={`
                      h-10 w-full rounded-lg border-2 text-sm font-medium transition-all duration-200
                      hover:scale-105 hover:shadow-md
                      ${serviceScore === i 
                        ? 'border-[#D5B170] bg-[#D5B170] text-white shadow-lg' 
                        : 'border-slate-200 bg-white text-slate-600 hover:border-[#D5B170]/50 hover:bg-[#D5B170]/10'
                      }
                    `}
                  >
                    {i}
                  </button>
                ))}
              </div>

              <div className="flex justify-between text-xs text-slate-500">
                <span>Muito insatisfeito</span>
                <span>Muito satisfeito</span>
              </div>

              {errors.serviceScore && (
                <p className="text-xs text-red-500 text-center">
                  Por favor, selecione uma nota para o atendimento
                </p>
              )}

              {serviceScore !== null && (
                <div className="text-center p-4 bg-gradient-to-r from-slate-50 to-[#D5B170]/10 rounded-lg border border-[#D5B170]/20">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Star className={`h-5 w-5 ${getScoreColor(serviceScore)} fill-current`} />
                    <span className="text-lg font-bold text-[#101F2E]">{serviceScore}/10</span>
                  </div>
                  <p className={`text-sm font-medium ${getScoreColor(serviceScore)}`}>
                    {getScoreLabel(serviceScore)}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('request')}
                  className="flex-1 border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleScoreStep}
                  className="flex-1 bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white"
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {step === 'comment' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="comment" className="text-sm font-medium text-[#101F2E] flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#D5B170]" />
                  {isCommentRequired() ? 'Deixe seu comentário sobre o atendimento' : 'Deixe seu comentário (opcional)'}
                </Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    const trimmed = e.target.value.trim();
                    if (!isCommentRequired() && !trimmed) {
                      // Se não é obrigatório e está vazio, não há erro
                      setErrors(prev => ({ ...prev, comment: false }));
                    } else if (trimmed && validateCommentLength(trimmed)) {
                      // Se tem conteúdo e atende o mínimo, não há erro
                      setErrors(prev => ({ ...prev, comment: false }));
                    } else if (isCommentRequired() && trimmed && validateCommentLength(trimmed)) {
                      // Se é obrigatório, tem conteúdo e atende o mínimo, não há erro
                      setErrors(prev => ({ ...prev, comment: false }));
                    }
                    setShowMandatoryWarning(false);
                  }}
                  placeholder={
                    isCommentRequired()
                      ? `Conte-nos mais sobre sua experiência para nos ajudar a melhorar o atendimento... (mínimo ${MIN_COMMENT_LENGTH} caracteres)`
                      : `Conte-nos mais sobre sua experiência, sugestões ou elogios (opcional, mas se fornecido, mínimo ${MIN_COMMENT_LENGTH} caracteres)...`
                  }
                  className={`min-h-[120px] border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170] ${
                    errors.comment ? 'border-red-500' : ''
                  }`}
                />
                
                {/* Contador de caracteres */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">
                    {comment.trim().length} caracteres
                    {(isCommentRequired() || comment.trim().length > 0) && ` (mínimo ${MIN_COMMENT_LENGTH})`}
                  </span>
                  {comment.trim().length > 0 && comment.trim().length < MIN_COMMENT_LENGTH && (
                    <span className="text-xs text-amber-600">
                      Faltam {MIN_COMMENT_LENGTH - comment.trim().length} caracteres
                    </span>
                  )}
                  {comment.trim().length >= MIN_COMMENT_LENGTH && (
                    <span className="text-xs text-green-600">
                      ✓ Comprimento adequado
                    </span>
                  )}
                </div>

                {errors.comment && (
                  <p className="text-xs text-red-500">
                    {getCommentErrorMessage()}
                  </p>
                )}
                
                <p className="text-xs text-slate-500">
                  {isCommentRequired() ? (
                    <>
                      <span className="text-red-500">*</span> Campo obrigatório - Sua avaliação nos ajuda a melhorar
                    </>
                  ) : (
                    'Seu feedback nos ajuda a melhorar continuamente nosso atendimento.'
                  )}
                </p>
                
                {/* Aviso visual quando comentário não é obrigatório */}
                {!isCommentRequired() && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <p className="text-xs text-green-700">
                      Como sua avaliação foi boa (7-10), o comentário é opcional!
                    </p>
                  </div>
                )}
              </div>

              {/* Resumo da avaliação */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Resumo da sua avaliação:</h4>
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Solicitação atendida:</span>
                    <span className={requestFulfilled ? 'text-green-600' : 'text-red-600'}>
                      {requestFulfilled ? '✅ Sim' : '❌ Não'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Nota do atendimento:</span>
                    <span className={`font-medium ${getScoreColor(serviceScore!)}`}>
                      {serviceScore}/10 - {getScoreLabel(serviceScore!)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Comentário:</span>
                    <span className={isCommentRequired() ? 'text-red-600' : 'text-green-600'}>
                      {isCommentRequired() ? 'Obrigatório' : 'Opcional'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('score')}
                  className="flex-1 border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white"
                  disabled={
                    // Desabilitar se comentário é obrigatório e não atende os critérios
                    (isCommentRequired() && (!comment.trim() || !validateCommentLength(comment.trim()))) ||
                    // Ou se comentário foi fornecido mas não atende o mínimo
                    (comment.trim() && !validateCommentLength(comment.trim()))
                  }
                >
                  Enviar Avaliação
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NPSModal;