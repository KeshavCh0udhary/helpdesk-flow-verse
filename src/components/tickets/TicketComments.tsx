
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { EnhancedComments } from '@/components/EnhancedComments';

interface TicketCommentsProps {
  ticketId: string;
  ticketStatus: string;
}

export const TicketComments = ({ ticketId, ticketStatus }: TicketCommentsProps) => {
  const { user } = useAuth();
  const isResolved = ticketStatus === 'resolved' || ticketStatus === 'closed';

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments</CardTitle>
      </CardHeader>
      <CardContent>
        {isResolved && (
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Comments are disabled for resolved tickets. You can view existing comments but cannot add new ones.
            </AlertDescription>
          </Alert>
        )}
        
        <EnhancedComments 
          ticketId={ticketId} 
          disableNewComments={isResolved}
        />
      </CardContent>
    </Card>
  );
};
