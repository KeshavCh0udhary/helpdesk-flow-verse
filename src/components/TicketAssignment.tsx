
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Clock, AlertCircle } from 'lucide-react';

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Unassigned Tickets
        </CardTitle>
        <CardDescription>
          {unassignedTickets.length} tickets waiting for assignment
        </CardDescription>
      </CardHeader>
      <CardContent>
        {unassignedTickets.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">All tickets assigned!</h3>
            <p className="text-gray-600">No unassigned tickets at the moment</p>
          </div>
        ) : (
          <div className="space-y-4">
            {unassignedTickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between p-4 border rounded-lg">
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
                  <Select 
                    onValueChange={(agentId) => assignTicket(ticket.id, agentId)}
                    disabled={assigning === ticket.id}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Assign to agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {assigning === ticket.id && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
