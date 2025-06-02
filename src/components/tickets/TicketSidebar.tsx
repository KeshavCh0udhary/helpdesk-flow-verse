
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPriorityColorClasses } from '@/utils/colorUtils';
import { Database } from '@/integrations/supabase/types';

type TicketPriority = Database['public']['Enums']['ticket_priority'];

interface TicketSidebarProps {
  ticket: {
    created_at: string;
    priority: TicketPriority;
    department: { name: string };
  };
}

export const TicketSidebar = ({ ticket }: TicketSidebarProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-gray-500">Created</p>
          <p className="font-medium">{new Date(ticket.created_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Priority</p>
          <Badge className={getPriorityColorClasses(ticket.priority)}>
            {ticket.priority}
          </Badge>
        </div>
        <div>
          <p className="text-sm text-gray-500">Department</p>
          <p className="font-medium">{ticket.department.name}</p>
        </div>
      </CardContent>
    </Card>
  );
};
