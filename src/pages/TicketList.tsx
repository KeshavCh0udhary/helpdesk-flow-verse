import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  created_by_user: { full_name: string };
  assigned_agent: { full_name: string } | null;
  department: { name: string };
}

export const TicketList = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    const priorityParam = params.get('priority');
    const searchParam = params.get('search');

    if (statusParam && ['open', 'closed', 'in_progress', 'resolved'].includes(statusParam)) {
      setStatusFilter(statusParam as 'open' | 'closed' | 'in_progress' | 'resolved');
    }
    if (priorityParam && ['high', 'low', 'medium', 'urgent'].includes(priorityParam)) {
      setPriorityFilter(priorityParam as 'high' | 'low' | 'medium' | 'urgent');
    }
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [location.search]);

  useEffect(() => {
    if (user) {
      fetchTickets();
    }
  }, [user, statusFilter, priorityFilter, searchTerm]);

  const fetchTickets = async () => {
    if (!user) return;

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
          department:departments(name)
        `)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'unassigned') {
          query = query.is('assigned_to_agent_id', null);
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      // Apply priority filter
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      // Apply search term
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      const { data: ticketsData, error } = await query;

      if (error) throw error;

      if (ticketsData) {
        // Get user profiles for creators and agents
        const userIds = [...new Set([
          ...ticketsData.map(t => t.created_by_user_id),
          ...ticketsData.map(t => t.assigned_to_agent_id).filter(Boolean)
        ])];

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
          created_by_user: profilesMap[ticket.created_by_user_id] || { full_name: 'Unknown User' },
          assigned_agent: ticket.assigned_to_agent_id ? profilesMap[ticket.assigned_to_agent_id] || null : null
        }));

        setTickets(ticketsWithUsers);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'destructive';
      case 'in_progress': return 'default';
      case 'resolved': return 'outline';
      case 'closed': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {statusFilter === 'all' ? 'All Tickets' : 
             statusFilter === 'unassigned' ? 'Unassigned Tickets' :
             `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1).replace('_', ' ')} Tickets`}
          </h1>
          <p className="text-gray-600">
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {tickets.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-gray-500">No tickets found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : (
          tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{ticket.title}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {ticket.description.length > 100 
                        ? `${ticket.description.substring(0, 100)}...` 
                        : ticket.description}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Badge variant={getPriorityColor(ticket.priority)}>
                      {ticket.priority}
                    </Badge>
                    <Badge variant={getStatusColor(ticket.status)}>
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    <p>Created by: {ticket.created_by_user.full_name}</p>
                    <p>Department: {ticket.department.name}</p>
                    <p>Assigned to: {ticket.assigned_agent?.full_name || 'Unassigned'}</p>
                    <p>Created: {format(new Date(ticket.created_at), 'MMM dd, yyyy HH:mm')}</p>
                  </div>
                  <Link to={`/ticket/${ticket.id}`}>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
