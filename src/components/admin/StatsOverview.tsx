
import { StatsCards } from '@/components/dashboard/StatsCards';

interface StatsOverviewProps {
  stats: {
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    totalAgents: number;
    totalEmployees: number;
  };
}

export const StatsOverview = ({ stats }: StatsOverviewProps) => {
  return <StatsCards stats={stats} />;
};
