
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Database } from '@/integrations/supabase/types';
import { getPriorityColorClasses, getStatusColorClasses } from '@/utils/colorUtils';

type TicketStatus = Database['public']['Enums']['ticket_status'];
type TicketPriority = Database['public']['Enums']['ticket_priority'];

interface TicketItem {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  department: { name: string } | null;
  created_by_user: { full_name: string } | null;
  assigned_to_agent: { full_name: string } | null;
}

interface TicketCardProps {
  ticket: TicketItem;
}

export const TicketCard = ({ ticket }: TicketCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">
              <Link 
                to={`/tickets/${ticket.id}`}
                className="hover:text-blue-600 transition-colors"
              >
                {ticket.title}
              </Link>
            </CardTitle>
            <CardDescription className="mt-1">
              {ticket.description.length > 100 
                ? `${ticket.description.substring(0, 100)}...` 
                : ticket.description
              }
            </CardDescription>
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
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center text-sm text-gray-600">
          <div className="space-y-1">
            <p>Department: {ticket.department?.name || 'Unassigned'}</p>
            <p>Created by: {ticket.created_by_user?.full_name || 'Unknown'}</p>
            {ticket.assigned_to_agent && (
              <p>Assigned to: {ticket.assigned_to_agent.full_name}</p>
            )}
          </div>
          <div className="text-right">
            <p>Created: {new Date(ticket.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
