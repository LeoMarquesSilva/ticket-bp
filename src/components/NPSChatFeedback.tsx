import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, ThumbsUp, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';

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
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  
  // Usar isSubmitting externo ou estado interno
  const submitting = isSubmitting || internalSubmitting;

  const handleRequestStep = () => {
    if (requestFulfilled === null) {
      setErrors(prev => ({ ...prev, requestFulfilled: true }));
      return;
    }

    if (requestFulfilled === false && !notFulfilledReason.trim()) {
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
    if (!comment.trim()) {
      setErrors(prev => ({ ...prev, comment: true }));
      return;
    }

    if (requestFulfilled !== null && serviceScore !== null) {
      try {
        setInternalSubmitting(true);
        
        await onSubmit({
          requestFulfilled,
          notFulfilledReason: !requestFulfilled ? notFulfilledReason.trim() : undefined,
          serviceScore,
          comment: comment.trim()
        });
      } catch (error) {
        console.error('Erro ao enviar feedback:', error);
      } finally {
        setInternalSubmitting(false);
      }
    }
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

  return (
    <Card className="w-full max-w-md mx-auto border-[#D5B170]/30">
      <CardHeader className="bg-gradient-to-r from-[#101F2E]/5 to-[#D5B170]/10 py-3">
        <CardTitle className="text-lg flex items-center justify-center gap-2 text-[#101F2E]">
          <ThumbsUp className="h-5 w-5 text-[#D5B170]" />
          Avalie seu atendimento
        </CardTitle>
        <CardDescription className="text-center text-slate-600">
          Sua opinião é muito importante para melhorarmos nossos serviços
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-4">
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
                }}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="fulfilled-yes" />
                  <Label htmlFor="fulfilled-yes" className="cursor-pointer">Sim</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="fulfilled-no" />
                  <Label htmlFor="fulfilled-no" className="cursor-pointer">Não</Label>
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
                    if (e.target.value.trim()) {
                      setErrors(prev => ({ ...prev, notFulfilledReason: false }));
                    }
                  }}
                  placeholder="Explique por que sua solicitação não foi atendida..."
                  className={`min-h-[80px] border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170] ${
                    errors.notFulfilledReason ? 'border-red-500' : ''
                  }`}
                />
                {errors.notFulfilledReason && (
                  <p className="text-xs text-red-500">
                    Por favor, explique por que sua solicitação não foi atendida
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={handleRequestStep}
              className="w-full bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white"
            >
              Continuar
            </Button>
          </div>
        )}

        {step === 'score' && (
          <div className="space-y-4">
            <div className="text-center">
              <Label className="text-sm font-medium text-[#101F2E] flex items-center justify-center gap-2">
                <Star className="h-4 w-4 text-[#D5B170]" />
                Como você avalia nosso atendimento?
              </Label>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                <button
                  key={score}
                  onClick={() => {
                    setServiceScore(score);
                    setErrors(prev => ({ ...prev, serviceScore: false }));
                  }}
                  className={`
                    h-10 w-full rounded-lg border-2 text-sm font-medium transition-all duration-200
                    hover:scale-105 hover:shadow-md
                    ${serviceScore === score 
                      ? 'border-[#D5B170] bg-[#D5B170] text-white shadow-lg' 
                      : 'border-slate-200 bg-white text-slate-600 hover:border-[#D5B170]/50 hover:bg-[#D5B170]/10'
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
              <p className="text-xs text-red-500 text-center">
                Por favor, selecione uma nota para o atendimento
              </p>
            )}

            {serviceScore !== null && (
              <div className="text-center p-3 bg-gradient-to-r from-slate-50 to-[#D5B170]/10 rounded-lg border border-[#D5B170]/20">
                <div className="flex items-center justify-center gap-2">
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
                Deixe seu comentário sobre o atendimento
              </Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (e.target.value.trim()) {
                    setErrors(prev => ({ ...prev, comment: false }));
                  }
                }}
                placeholder="Conte-nos mais sobre sua experiência..."
                className={`min-h-[100px] border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170] ${
                  errors.comment ? 'border-red-500' : ''
                }`}
              />
              {errors.comment && (
                <p className="text-xs text-red-500">
                  Por favor, deixe um comentário sobre o atendimento
                </p>
              )}
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
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-[#101F2E] to-[#2a3f52] hover:from-[#0a1520] hover:to-[#1f3240] text-white"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  'Enviar Avaliação'
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NPSChatFeedback;