import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, ThumbsUp, MessageSquare } from 'lucide-react';

interface NPSModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (score: number, feedback?: string) => void;
  ticketTitle: string;
}

const NPSModal: React.FC<NPSModalProps> = ({ isOpen, onClose, onSubmit, ticketTitle }) => {
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [step, setStep] = useState<'score' | 'feedback'>('score');

  const handleScoreSelect = (selectedScore: number) => {
    setScore(selectedScore);
    setStep('feedback');
  };

  const handleSubmit = () => {
    if (score !== null) {
      onSubmit(score, feedback.trim() || undefined);
      handleClose();
    }
  };

  const handleClose = () => {
    setScore(null);
    setFeedback('');
    setStep('score');
    onClose();
  };

  const getScoreColor = (scoreValue: number) => {
    if (scoreValue <= 6) return 'text-red-500';
    if (scoreValue <= 8) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getScoreLabel = (scoreValue: number) => {
    if (scoreValue <= 6) return 'Detrator';
    if (scoreValue <= 8) return 'Neutro';
    return 'Promotor';
  };

  const getScoreDescription = (scoreValue: number) => {
    if (scoreValue <= 6) return 'Não recomendaria nosso suporte';
    if (scoreValue <= 8) return 'Experiência neutra com nosso suporte';
    return 'Recomendaria nosso suporte';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#101F2E]">
            <ThumbsUp className="h-5 w-5 text-[#D5B170]" />
            Avalie Nosso Atendimento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-slate-600 mb-2">
              Ticket resolvido: <span className="font-medium text-[#101F2E]">{ticketTitle}</span>
            </p>
            <p className="text-xs text-slate-500">
              Sua opinião nos ajuda a melhorar nosso atendimento
            </p>
          </div>

          {step === 'score' && (
            <div className="space-y-4">
              <div className="text-center">
                <Label className="text-sm font-medium text-[#101F2E]">
                  Em uma escala de 0 a 10, o quanto você recomendaria nosso suporte?
                </Label>
              </div>

              <div className="grid grid-cols-11 gap-1">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => handleScoreSelect(i)}
                    className={`
                      h-10 w-full rounded-lg border-2 text-sm font-medium transition-all duration-200
                      hover:scale-105 hover:shadow-md
                      ${score === i 
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
                <span>Muito improvável</span>
                <span>Muito provável</span>
              </div>
            </div>
          )}

          {step === 'feedback' && score !== null && (
            <div className="space-y-4">
              <div className="text-center p-4 bg-gradient-to-r from-slate-50 to-[#D5B170]/10 rounded-lg border border-[#D5B170]/20">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Star className={`h-5 w-5 ${getScoreColor(score)} fill-current`} />
                  <span className="text-lg font-bold text-[#101F2E]">{score}/10</span>
                </div>
                <p className={`text-sm font-medium ${getScoreColor(score)}`}>
                  {getScoreLabel(score)}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {getScoreDescription(score)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback" className="text-sm font-medium text-[#101F2E] flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comentários adicionais (opcional)
                </Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Conte-nos mais sobre sua experiência..."
                  className="min-h-[80px] border-slate-300 focus:border-[#D5B170] focus:ring-[#D5B170]"
                />
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
                >
                  Enviar Avaliação
                </Button>
              </div>
            </div>
          )}

          {step === 'score' && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                Pular Avaliação
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NPSModal;