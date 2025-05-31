
import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus } from 'lucide-react';

interface TicketAssignmentCardProps {
  ticketCount: number;
  children: ReactNode;
}

export const TicketAssignmentCard = ({ ticketCount, children }: TicketAssignmentCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Unassigned Tickets
        </CardTitle>
        <CardDescription>
          {ticketCount} tickets waiting for assignment
        </CardDescription>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};
