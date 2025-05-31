
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Stats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  totalAgents: number;
  totalEmployees: number;
}

interface SystemStatusProps {
  stats: Stats;
}

export const SystemStatus = ({ stats }: SystemStatusProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
        <CardDescription>Current system metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Resolution Rate</span>
            <span className="text-sm font-medium">
              {stats.totalTickets > 0 
                ? Math.round((stats.resolvedTickets / stats.totalTickets) * 100)
                : 0}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Active Tickets</span>
            <span className="text-sm font-medium">
              {stats.openTickets + stats.inProgressTickets}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Agent Utilization</span>
            <span className="text-sm font-medium">
              {stats.totalAgents > 0 
                ? Math.round(((stats.openTickets + stats.inProgressTickets) / stats.totalAgents) * 100) / 100
                : 0} tickets/agent
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
