
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyTicketStateProps {
  hasTickets: boolean;
  userRole?: string;
}

export const EmptyTicketState = ({ hasTickets, userRole }: EmptyTicketStateProps) => {
  return (
    <Card>
      <CardContent className="text-center py-12">
        <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
        <p className="text-gray-600">
          {!hasTickets 
            ? "You haven't created any tickets yet." 
            : "No tickets match your current filters."
          }
        </p>
        {userRole === 'employee' && !hasTickets && (
          <Link to="/tickets/new" className="mt-4 inline-block">
            <Button>Create Your First Ticket</Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
};
