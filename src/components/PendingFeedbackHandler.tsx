import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { Ticket } from '@/types';

interface PendingFeedbackHandlerProps {
  tickets: Ticket[];
  onFeedbackSubmitted: () => void;
  onOpenTicket?: (ticket: Ticket) => void;
}

const PendingFeedbackHandler: React.FC<PendingFeedbackHandlerProps> = ({
  tickets,
  onFeedbackSubmitted,
  onOpenTicket,
}) => {
  const pendingFeedbackTickets = (tickets || []).filter(
    ticket => ticket && ticket.status === 'resolved' && !ticket.feedbackSubmittedAt
  );

  const handleOpenFirstTicket = () => {
    if (pendingFeedbackTickets.length > 0 && onOpenTicket) {
      onOpenTicket(pendingFeedbackTickets[0]);
    }
  };

  if (pendingFeedbackTickets.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-400 p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-800 font-medium text-sm">
              🌟 Avaliação Pendente:
            </span>
            <span className="text-amber-700 text-sm">
              {pendingFeedbackTickets.length} ticket{pendingFeedbackTickets.length > 1 ? 's' : ''} aguardando sua avaliação
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
            {pendingFeedbackTickets.length}
          </Badge>
          {onOpenTicket && (
            <Button
              size="sm"
              onClick={handleOpenFirstTicket}
              className="bg-gradient-to-r from-[#D5B170] to-[#c4a05f] hover:from-[#c4a05f] hover:to-[#b8955a] text-white text-xs px-3 py-1 h-7"
            >
              <ArrowRight className="h-3 w-3 mr-1" />
              Avaliar Agora
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PendingFeedbackHandler;