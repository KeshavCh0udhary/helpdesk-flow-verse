
import { useAuth } from '@/hooks/useAuth';
import { TicketAssignment } from '@/components/TicketAssignment';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function TicketManagement() {
  const { profile, loading: authLoading } = useAuth();

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check for admin role after auth is loaded
  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
          <Link to="/">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Ticket Management</h1>
        <p className="text-gray-600">Assign unassigned tickets to support agents</p>
      </div>

      <TicketAssignment />
    </div>
  );
}
