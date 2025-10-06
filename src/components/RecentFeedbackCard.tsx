import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RecentFeedbackCardProps {
  id: string;
  title: string;
  npsScore?: number;
  serviceScore?: number;
  requestFulfilled?: boolean;
  comment?: string;
  resolvedAt?: string;
  ticketUrl: string;
  onOpenChat: () => void;
  isLoading?: boolean;
}

const RecentFeedbackCard: React.FC<RecentFeedbackCardProps> = ({
  id,
  title,
  npsScore,
  serviceScore,
  requestFulfilled,
  comment,
  resolvedAt,
  ticketUrl,
  onOpenChat,
  isLoading = false
}) => {
  // Função para abrir o chat
  const handleClick = () => {
    if (!isLoading) {
      onOpenChat();
    }
  };
  
  // Determinar o tipo de badge com base no NPS ou service score
  const getBadgeInfo = () => {
    if (npsScore !== undefined && npsScore !== null) {
      if (npsScore >= 9) return { text: 'Promotor', color: 'bg-green-100 text-green-800' };
      if (npsScore >= 7) return { text: 'Passivo', color: 'bg-yellow-100 text-yellow-800' };
      return { text: 'Detrator', color: 'bg-red-100 text-red-800' };
    }
    
    if (serviceScore !== undefined && serviceScore !== null) {
      if (serviceScore >= 9) return { text: 'Excelente', color: 'bg-green-100 text-green-800' };
      if (serviceScore >= 7) return { text: 'Bom', color: 'bg-green-100 text-green-800' };
      if (serviceScore >= 5) return { text: 'Médio', color: 'bg-yellow-100 text-yellow-800' };
      return { text: 'Ruim', color: 'bg-red-100 text-red-800' };
    }
    
    if (requestFulfilled !== undefined && requestFulfilled !== null) {
      return requestFulfilled 
        ? { text: 'Atendido', color: 'bg-green-100 text-green-800' }
        : { text: 'Não atendido', color: 'bg-red-100 text-red-800' };
    }
    
    return { text: 'Feedback', color: 'bg-blue-100 text-blue-800' };
  };
  
  const badgeInfo = getBadgeInfo();
  
  // Formatar a data de resolução
  const formattedDate = resolvedAt 
    ? formatDistanceToNow(new Date(resolvedAt), { addSuffix: true, locale: ptBR })
    : '';
  
  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${isLoading ? 'opacity-70' : ''}`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-medium text-sm line-clamp-1">{title}</h4>
          <Badge className={`ml-2 ${badgeInfo.color}`}>{badgeInfo.text}</Badge>
        </div>
        
        {comment && (
          <div className="flex items-start mt-2 text-sm text-slate-600">
            <MessageSquare className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
            <p className="line-clamp-2">{comment}</p>
          </div>
        )}
        
        <div className="flex justify-between items-center mt-3">
          {npsScore !== undefined && npsScore !== null && (
            <div className="flex items-center text-xs text-slate-500">
              {npsScore >= 7 ? (
                <ThumbsUp className="h-3 w-3 mr-1 text-green-500" />
              ) : (
                <ThumbsDown className="h-3 w-3 mr-1 text-red-500" />
              )}
              <span>NPS: {npsScore}</span>
            </div>
          )}
          
          {serviceScore !== undefined && serviceScore !== null && (
            <div className="flex items-center text-xs text-slate-500">
              <span>Cordialidade: {serviceScore}</span>
            </div>
          )}
          
          {formattedDate && (
            <div className="text-xs text-slate-500">{formattedDate}</div>
          )}
        </div>
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentFeedbackCard;