
import { useAuth } from '@/hooks/useAuth';
import { EmployeeDashboard } from '@/components/EmployeeDashboard';
import { SupportAgentDashboard } from '@/components/SupportAgentDashboard';
import { AdminDashboard } from '@/components/AdminDashboard';
import { DashboardLoadingSkeleton } from '@/components/ui/loading-skeleton';

export default function Dashboard() {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return <DashboardLoadingSkeleton />;
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
