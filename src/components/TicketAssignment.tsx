
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TicketAssignmentCard } from './ticket-assignment/TicketAssignmentCard';
import { EmptyTicketsState } from './ticket-assignment/EmptyTicketsState';
import { UnassignedTicketItem } from './ticket-assignment/UnassignedTicketItem';

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

export const TicketAssignment = () => {
  const [unassignedTickets, setUnassignedTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUnassignedTickets();
    fetchAgents();
  }, []);

  const fetchUnassignedTickets = async () => {
    try {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          title,
          status,
          priority,
          created_at,
          created_by_user_id,
          department:departments(name)
        `)
        .is('assigned_to_agent_id', null)
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;

      if (!ticketsData) {
        setUnassignedTickets([]);
        return;
      }

      // Get user profiles
      const userIds = [...new Set(ticketsData.map(ticket => ticket.created_by_user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profilesMap = (profilesData || []).reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, { full_name: string }>);

      const ticketsWithUsers = ticketsData.map(ticket => ({
        ...ticket,
        created_by_user: profilesMap[ticket.created_by_user_id] || { full_name: 'Unknown User' }
      }));

      setUnassignedTickets(ticketsWithUsers);
    } catch (error) {
      console.error('Error fetching unassigned tickets:', error);
      toast({
        title: "Error",
        description: "Failed to load unassigned tickets",
        variant: "destructive",
      });
    }
  };

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'support_agent');

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignTicket = async (ticketId: string, agentId: string) => {
    setAssigning(ticketId);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ assigned_to_agent_id: agentId })
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Ticket assigned successfully",
      });

      fetchUnassignedTickets();
    } catch (error: any) {
      console.error('Error assigning ticket:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign ticket",
        variant: "destructive",
      });
    } finally {
      setAssigning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <TicketAssignmentCard ticketCount={unassignedTickets.length}>
      {unassignedTickets.length === 0 ? (
        <EmptyTicketsState />
      ) : (
        <div className="space-y-4">
          {unassignedTickets.map((ticket) => (
            <UnassignedTicketItem
              key={ticket.id}
              ticket={ticket}
              agents={agents}
              onAssign={assignTicket}
              isAssigning={assigning === ticket.id}
            />
          ))}
        </div>
      )}
    </TicketAssignmentCard>
  );
};
