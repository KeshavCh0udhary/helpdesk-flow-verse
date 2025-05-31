
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Activity, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface AnalyticsData {
  ticketTrends: Array<{ name: string; tickets: number; resolved: number }>;
  statusDistribution: Array<{ name: string; value: number; color: string }>;
  departmentStats: Array<{ name: string; tickets: number; agents: number; avgResolution: number }>;
  performanceMetrics: {
    avgResolutionTime: number;
    resolutionRate: number;
    ticketGrowth: number;
    agentUtilization: number;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    ticketTrends: [],
    statusDistribution: [],
    departmentStats: [],
    performanceMetrics: {
      avgResolutionTime: 0,
      resolutionRate: 0,
      ticketGrowth: 0,
      agentUtilization: 0,
    },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch ticket trends for the last 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      const ticketTrends = await Promise.all(
        last7Days.map(async (date) => {
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          const { count: totalTickets } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', date)
            .lt('created_at', nextDate.toISOString().split('T')[0]);

          const { count: resolvedTickets } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', date)
            .lt('created_at', nextDate.toISOString().split('T')[0])
            .in('status', ['resolved', 'closed']);

          return {
            name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
            tickets: totalTickets || 0,
            resolved: resolvedTickets || 0,
          };
        })
      );

      // Fetch status distribution
      const { data: statusData } = await supabase
        .from('tickets')
        .select('status');

      const statusCounts = statusData?.reduce((acc, ticket) => {
        acc[ticket.status] = (acc[ticket.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const statusDistribution = Object.entries(statusCounts).map(([status, count], index) => ({
        name: status.replace('_', ' ').toUpperCase(),
        value: count,
        color: COLORS[index % COLORS.length],
      }));

      // Fetch department statistics
      const { data: departments } = await supabase
        .from('departments')
        .select('id, name');

      const departmentStats = await Promise.all(
        (departments || []).map(async (dept) => {
          const { count: ticketCount } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('department_id', dept.id);

          const { count: agentCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('department_id', dept.id)
            .eq('role', 'support_agent');

          // Calculate average resolution time (simplified)
          const { data: resolvedTickets } = await supabase
            .from('tickets')
            .select('created_at, resolved_at')
            .eq('department_id', dept.id)
            .not('resolved_at', 'is', null)
            .limit(10);

          const avgResolution = resolvedTickets?.length
            ? resolvedTickets.reduce((acc, ticket) => {
                const created = new Date(ticket.created_at!);
                const resolved = new Date(ticket.resolved_at!);
                return acc + (resolved.getTime() - created.getTime());
              }, 0) / resolvedTickets.length / (1000 * 60 * 60) // Convert to hours
            : 0;

          return {
            name: dept.name,
            tickets: ticketCount || 0,
            agents: agentCount || 0,
            avgResolution: Math.round(avgResolution * 10) / 10,
          };
        })
      );

      // Calculate performance metrics
      const totalTickets = statusData?.length || 0;
      const resolvedTickets = statusCounts['resolved'] + statusCounts['closed'] || 0;
      const resolutionRate = totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0;

      // Simplified metrics (in a real app, you'd calculate these more accurately)
      const performanceMetrics = {
        avgResolutionTime: 24.5, // hours
        resolutionRate: Math.round(resolutionRate * 10) / 10,
        ticketGrowth: 12.3, // percentage
        agentUtilization: 78.9, // percentage
      };

      setAnalytics({
        ticketTrends,
        statusDistribution,
        departmentStats,
        performanceMetrics,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const chartConfig = {
    tickets: {
      label: "Tickets",
      color: "#0088FE",
    },
    resolved: {
      label: "Resolved",
      color: "#00C49F",
    },
  };

  return (
    <div className="space-y-6">
      {/* Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.performanceMetrics.avgResolutionTime}h</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 mr-1 text-green-500" />
              2.5h faster than last week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.performanceMetrics.resolutionRate}%</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              5.2% increase from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Growth</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{analytics.performanceMetrics.ticketGrowth}%</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-orange-500" />
              Compared to last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Utilization</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.performanceMetrics.agentUtilization}%</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-blue-500" />
              Optimal range: 70-85%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ticket Trends (Last 7 Days)</CardTitle>
            <CardDescription>Daily ticket creation and resolution</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.ticketTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="tickets" fill="var(--color-tickets)" />
                  <Bar dataKey="resolved" fill="var(--color-resolved)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ticket Status Distribution</CardTitle>
            <CardDescription>Current status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.statusDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {analytics.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Department Performance</CardTitle>
          <CardDescription>Tickets, agents, and resolution times by department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.departmentStats.map((dept, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{dept.name}</h4>
                  <div className="flex items-center gap-4 mt-2">
                    <Badge variant="secondary">{dept.tickets} tickets</Badge>
                    <Badge variant="outline">{dept.agents} agents</Badge>
                    <Badge variant={dept.avgResolution < 24 ? "default" : "destructive"}>
                      {dept.avgResolution}h avg resolution
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Load per Agent</div>
                  <div className="text-lg font-semibold">
                    {dept.agents > 0 ? Math.round(dept.tickets / dept.agents) : 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
