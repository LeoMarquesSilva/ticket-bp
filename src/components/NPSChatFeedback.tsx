import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, ThumbsUp, MessageSquare, CheckCircle, AlertCircle, Send } from 'lucide-react';

interface NPSChatFeedbackProps {
  ticketTitle: string;
  onSubmit: (data: {
    requestFulfilled: boolean;
    notFulfilledReason?: string;
    serviceScore: number;
    comment: string;
  }) => void;
  isSubmitting?: boolean;
}

const NPSChatFeedback: React.FC<NPSChatFeedbackProps> = ({ 
  ticketTitle, 
  onSubmit,
  isSubmitting = false
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

  const handleSubmit = async () => {
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
      await onSubmit({
        requestFulfilled,
        notFulfilledReason: !requestFulfilled ? notFulfilledReason.trim() : undefined,
        serviceScore,
        comment: trimmedComment
      });
    }
  };

  const getScoreColor = (scoreValue: number) => {
    if (scoreValue <= 6) return 'text-responsum-accent';
    if (scoreValue <= 8) return 'text-responsum-secondary';
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
    <div className="w-full space-y-4">
      {step === 'request' && (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-responsum-dark mb-2">
              Avalie seu atendimento
            </h3>
            <p className="text-sm text-slate-600">
              Sua opinião é muito importante para melhorarmos nossos serviços
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-responsum-dark flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-responsum-primary" />
              Sua solicitação foi atendida?
            </Label>
            
            <RadioGroup 
              value={requestFulfilled === null ? undefined : requestFulfilled ? 'yes' : 'no'}
              onValueChange={(value) => {
                setRequestFulfilled(value === 'yes');
                setErrors(prev => ({ ...prev, requestFulfilled: false }));
              }}
              className="flex space-x-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="fulfilled-yes" />
                <Label htmlFor="fulfilled-yes" className="cursor-pointer text-sm">
                  ✅ Sim, foi atendida
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="fulfilled-no" />
                <Label htmlFor="fulfilled-no" className="cursor-pointer text-sm">
                  ❌ Não foi atendida
                </Label>
              </div>
            </RadioGroup>
            
            {errors.requestFulfilled && (
              <p className="text-xs text-responsum-accent mt-1">
                Por favor, selecione uma opção
              </p>
            )}
          </div>

          {requestFulfilled === false && (
            <div className="space-y-2">
              <Label htmlFor="notFulfilledReason" className="text-sm font-medium text-responsum-dark flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-responsum-secondary" />
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
                }}
                placeholder={`Explique por que sua solicitação não foi atendida... (mínimo ${MIN_COMMENT_LENGTH} caracteres)`}
                className={`min-h-[80px] text-sm border-slate-300 focus:border-responsum-primary focus:ring-responsum-primary ${
                  errors.notFulfilledReason ? 'border-responsum-accent' : ''
                }`}
                rows={3}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  {notFulfilledReason.trim().length}/{MIN_COMMENT_LENGTH} caracteres mínimos
                </span>
                {notFulfilledReason.trim().length > 0 && notFulfilledReason.trim().length < MIN_COMMENT_LENGTH && (
                  <span className="text-xs text-responsum-secondary">
                    Faltam {MIN_COMMENT_LENGTH - notFulfilledReason.trim().length} caracteres
                  </span>
                )}
              </div>
              {errors.notFulfilledReason && (
                <p className="text-xs text-responsum-accent">
                  {getNotFulfilledReasonError()}
                </p>
              )}
            </div>
          )}

          <Button
            onClick={handleRequestStep}
            className="w-full bg-responsum-dark hover:bg-responsum-dark/90 text-white"
            disabled={isSubmitting}
          >
            Continuar
          </Button>
        </div>
      )}

      {step === 'score' && (
        <div className="space-y-4">
          <div className="text-center">
            <Label className="text-lg font-semibold text-responsum-dark flex items-center justify-center gap-2 mb-2">
              <Star className="h-5 w-5 text-responsum-primary" />
              Como você avalia nosso atendimento?
            </Label>
            <p className="text-sm text-slate-600">
              Dê uma nota de 1 a 10 para a cordialidade e profissionalismo do atendente.
            </p>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
              <button
                key={score}
                onClick={() => {
                  setServiceScore(score);
                  setErrors(prev => ({ ...prev, serviceScore: false }));
                }}
                className={`
                  h-12 w-full rounded-lg border-2 text-sm font-bold transition-all duration-200
                  hover:scale-105 hover:shadow-md
                  ${serviceScore === score 
                    ? 'border-responsum-primary bg-responsum-primary text-responsum-dark shadow-lg' 
                    : 'border-slate-200 bg-white text-slate-600 hover:border-responsum-primary/50 hover:bg-responsum-primary/10'
                  }
                `}
              >
                {score}
              </button>
            ))}
          </div>

          <div className="flex justify-between text-xs text-slate-500">
            <span>Muito insatisfeito</span>
            <span>Muito satisfeito</span>
          </div>

          {errors.serviceScore && (
            <p className="text-xs text-responsum-accent text-center">
              Por favor, selecione uma nota para o atendimento
            </p>
          )}

          {serviceScore !== null && (
            <div className="text-center p-3 bg-gradient-to-r from-slate-50 to-responsum-primary/10 rounded-lg border border-responsum-primary/20">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Star className={`h-5 w-5 ${getScoreColor(serviceScore)} fill-current`} />
                <span className="text-lg font-bold text-responsum-dark">{serviceScore}/10</span>
              </div>
              <p className={`text-sm font-medium ${getScoreColor(serviceScore)}`}>
                {getScoreLabel(serviceScore)}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep('request')}
              className="flex-1 border-slate-300 text-slate-600 hover:bg-slate-50"
              disabled={isSubmitting}
            >
              Voltar
            </Button>
            <Button
              onClick={handleScoreStep}
              className="flex-1 bg-responsum-dark hover:bg-responsum-dark/90 text-white"
              disabled={isSubmitting}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 'comment' && (
        <div className="space-y-4">
          <div className="text-center">
            <Label className="text-lg font-semibold text-responsum-dark flex items-center justify-center gap-2 mb-2">
              <MessageSquare className="h-5 w-5 text-responsum-primary" />
              {isCommentRequired() ? 'Deixe seu comentário' : 'Deixe seu comentário (opcional)'}
            </Label>
            <p className="text-sm text-slate-600">
              {isCommentRequired() 
                ? 'Conte-nos mais sobre sua experiência para nos ajudar a melhorar'
                : 'Conte-nos mais sobre sua experiência, se desejar'
              }
            </p>
          </div>

          <div className="space-y-2">
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
              }}
              placeholder={
                isCommentRequired()
                  ? `Conte-nos mais sobre sua experiência para nos ajudar a melhorar o atendimento... (mínimo ${MIN_COMMENT_LENGTH} caracteres)`
                  : `Conte-nos mais sobre sua experiência, sugestões ou elogios (opcional, mas se fornecido, mínimo ${MIN_COMMENT_LENGTH} caracteres)...`
              }
              className={`min-h-[120px] text-sm border-slate-300 focus:border-responsum-primary focus:ring-responsum-primary ${
                errors.comment ? 'border-responsum-accent' : ''
              }`}
              rows={5}
            />
            
            {/* Contador de caracteres */}
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">
                {comment.trim().length} caracteres
                {(isCommentRequired() || comment.trim().length > 0) && ` (mínimo ${MIN_COMMENT_LENGTH})`}
              </span>
              {comment.trim().length > 0 && comment.trim().length < MIN_COMMENT_LENGTH && (
                <span className="text-xs text-responsum-secondary">
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
              <p className="text-xs text-responsum-accent">
                {getCommentErrorMessage()}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {isCommentRequired()
                ? 'Seu feedback é importante para melhorarmos nosso atendimento.'
                : 'Seu feedback nos ajuda a melhorar continuamente nosso atendimento.'
              }
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
                <span className={requestFulfilled ? 'text-green-600' : 'text-responsum-accent'}>
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
                <span className={isCommentRequired() ? 'text-responsum-accent' : 'text-green-600'}>
                  {isCommentRequired() ? 'Obrigatório' : 'Opcional'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep('score')}
              className="flex-1 border-slate-300 text-slate-600 hover:bg-slate-50"
              disabled={isSubmitting}
            >
              Voltar
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-responsum-primary hover:bg-responsum-primary/90 text-responsum-dark flex items-center justify-center gap-2 font-medium"
              disabled={
                isSubmitting || 
                // Desabilitar se comentário é obrigatório e não atende os critérios
                (isCommentRequired() && (!comment.trim() || !validateCommentLength(comment.trim()))) ||
                // Ou se comentário foi fornecido mas não atende o mínimo
                (comment.trim() && !validateCommentLength(comment.trim()))
              }
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-responsum-dark"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar Avaliação
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NPSChatFeedback;