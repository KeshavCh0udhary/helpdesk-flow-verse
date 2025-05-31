
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { AgentSelector } from './AgentSelector';

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  created_by_user: { full_name: string };
  department: { name: string };
}

interface Agent {
  id: string;
  full_name: string;
  email: string;
}

interface UnassignedTicketItemProps {
  ticket: Ticket;
  agents: Agent[];
  onAssign: (ticketId: string, agentId: string) => void;
  isAssigning: boolean;
}

export const UnassignedTicketItem = ({ ticket, agents, onAssign, isAssigning }: UnassignedTicketItemProps) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const handleAssign = (agentId: string) => {
    onAssign(ticket.id, agentId);
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="font-medium">{ticket.title}</h4>
          <Badge className={getPriorityColor(ticket.priority)}>
            {ticket.priority}
          </Badge>
        </div>
        <div className="text-sm text-gray-600">
          <p>Created by: {ticket.created_by_user.full_name}</p>
          <p>Department: {ticket.department.name}</p>
          <p className="flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" />
            {new Date(ticket.created_at).toLocaleString()}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <AgentSelector
          agents={agents}
          onAssign={handleAssign}
          disabled={isAssigning}
        />
        
        {isAssigning && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        )}
      </div>
    </div>
  );
};
