
import { useAuth } from '@/hooks/useAuth';
import { EmployeeDashboard } from '@/components/EmployeeDashboard';
import { SupportAgentDashboard } from '@/components/SupportAgentDashboard';
import { AdminDashboard } from '@/components/AdminDashboard';

export default function Dashboard() {
  const { profile } = useAuth();

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  switch (profile.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'support_agent':
      return <SupportAgentDashboard />;
    case 'employee':
    default:
      return <EmployeeDashboard />;
  }
}
