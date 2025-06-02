
interface TicketInfoProps {
  ticket: {
    created_by_user: { full_name: string };
    department: { name: string };
    assigned_to_agent: { full_name: string } | null;
  };
}

export const TicketInfo = ({ ticket }: TicketInfoProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div>
        <p className="text-sm text-gray-500">Created by</p>
        <p className="font-medium">{ticket.created_by_user.full_name}</p>
      </div>
      <div>
        <p className="text-sm text-gray-500">Department</p>
        <p className="font-medium">{ticket.department.name}</p>
      </div>
      <div>
        <p className="text-sm text-gray-500">Assigned to</p>
        <p className="font-medium">{ticket.assigned_to_agent?.full_name || 'Unassigned'}</p>
      </div>
    </div>
  );
};
