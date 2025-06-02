
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { getStatusColorClasses, getPriorityColorClasses } from '@/utils/colorUtils';
import { Database } from '@/integrations/supabase/types';

type TicketStatus = Database['public']['Enums']['ticket_status'];
type TicketPriority = Database['public']['Enums']['ticket_priority'];

interface TicketHeaderProps {
  ticket: {
    id: string;
    title: string;
    status: TicketStatus;
    priority: TicketPriority;
  };
}

export const TicketHeader = ({ ticket }: TicketHeaderProps) => {
  return (
    <div className="mb-6">
      <Link to="/tickets">
        <Button variant="outline" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tickets
        </Button>
      </Link>
      
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{ticket.title}</h1>
          <p className="text-gray-600">Ticket #{ticket.id.slice(0, 8)}</p>
        </div>
        
        <div className="flex gap-2">
          <Badge className={getStatusColorClasses(ticket.status)}>
            {ticket.status.replace('_', ' ')}
          </Badge>
          <Badge className={getPriorityColorClasses(ticket.priority)}>
            {ticket.priority}
          </Badge>
        </div>
      </div>
    </div>
  );
};
