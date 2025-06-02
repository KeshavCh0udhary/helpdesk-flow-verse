
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TicketFilters } from '@/components/tickets/TicketFilters';
import { TicketCard } from '@/components/tickets/TicketCard';
import { EmptyTicketState } from '@/components/tickets/EmptyTicketState';
import { useTickets } from '@/hooks/useTickets';
import { filterTickets } from '@/utils/ticketUtils';

const TicketList = () => {
  const { profile } = useAuth();
  const { tickets, loading } = useTickets(profile);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const filteredTickets = filterTickets(tickets, searchTerm, statusFilter, priorityFilter);

  // Dynamic title based on user role
  const pageTitle = profile?.role === 'admin' ? 'All Tickets' : 'My Tickets';
  const pageDescription = profile?.role === 'admin' 
    ? 'Manage and track all support tickets in the system'
    : 'Manage and track your support tickets';

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
          <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-gray-600">{pageDescription}</p>
        </div>
        {profile?.role === 'employee' && (
          <Link to="/tickets/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Ticket
            </Button>
          </Link>
        )}
      </div>

      <TicketFilters
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        onSearchChange={setSearchTerm}
        onStatusChange={setStatusFilter}
        onPriorityChange={setPriorityFilter}
      />

      {filteredTickets.length === 0 ? (
        <EmptyTicketState hasTickets={tickets.length > 0} userRole={profile?.role} />
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TicketList;
