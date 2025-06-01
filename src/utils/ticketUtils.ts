
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

export const filterTickets = (
  tickets: TicketItem[],
  searchTerm: string,
  statusFilter: string,
  priorityFilter: string
): TicketItem[] => {
  return tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter as TicketStatus;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter as TicketPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });
};
