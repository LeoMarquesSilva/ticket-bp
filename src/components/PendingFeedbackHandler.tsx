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
    <div className="bg-responsum-dark text-responsum-light border-l-4 border-responsum-primary p-3 mb-4 rounded-r-md shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-responsum-primary" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-responsum-secondary rounded-full animate-pulse"></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-responsum-light font-medium text-sm">
              🌟 Avaliação Pendente:
            </span>
            <span className="text-responsum-light/80 text-sm">
              {pendingFeedbackTickets.length} ticket{pendingFeedbackTickets.length > 1 ? 's' : ''} aguardando sua avaliação
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-responsum-dark text-responsum-primary border-responsum-primary/50 text-xs">
            {pendingFeedbackTickets.length}
          </Badge>
          {onOpenTicket && (
            <Button
              size="sm"
              onClick={handleOpenFirstTicket}
              className="bg-responsum-primary hover:bg-responsum-primary/90 text-responsum-dark font-medium text-xs px-3 py-1 h-7"
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