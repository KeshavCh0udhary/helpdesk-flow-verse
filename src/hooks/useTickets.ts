
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

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

interface Profile {
  id: string;
  role: 'admin' | 'employee' | 'support_agent';
}

export const useTickets = (profile: Profile | null) => {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    if (!profile) return;

    try {
      let query = supabase
        .from('tickets')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          created_at,
          created_by_user_id,
          assigned_to_agent_id,
          departments!inner(name)
        `);

      // Filter based on user role
      if (profile.role === 'employee') {
        query = query.eq('created_by_user_id', profile.id);
      } else if (profile.role === 'support_agent') {
        query = query.eq('assigned_to_agent_id', profile.id);
      }
      // Admin can see all tickets (no additional filter)

      query = query.order('created_at', { ascending: false });

      const { data: ticketsData, error } = await query;

      if (error) throw error;
      
      // Now fetch user profiles separately
      const userIds = new Set<string>();
      ticketsData?.forEach(ticket => {
        if (ticket.created_by_user_id) userIds.add(ticket.created_by_user_id);
        if (ticket.assigned_to_agent_id) userIds.add(ticket.assigned_to_agent_id);
      });

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(userIds));

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      
      // Map the data to match our interface
      const mappedTickets: TicketItem[] = (ticketsData || []).map(ticket => ({
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status as TicketStatus,
        priority: ticket.priority as TicketPriority,
        created_at: ticket.created_at,
        department: ticket.departments ? { name: ticket.departments.name } : null,
        created_by_user: ticket.created_by_user_id 
          ? { full_name: profilesMap.get(ticket.created_by_user_id)?.full_name || 'Unknown' }
          : null,
        assigned_to_agent: ticket.assigned_to_agent_id 
          ? { full_name: profilesMap.get(ticket.assigned_to_agent_id)?.full_name || 'Unknown' }
          : null,
      }));
      
      setTickets(mappedTickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [profile]);

  return { tickets, loading, refetch: fetchTickets };
};
