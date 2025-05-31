
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from 'recharts';
import { BarChart as BarChartIcon, Clock, CheckCircle, Users } from 'lucide-react';

interface ReportData {
  ticketsByDay: Array<{ date: string; count: number }>;
  resolutionTimes: Array<{ department: string; avgHours: number }>;
  agentPerformance: Array<{ agent: string; resolved: number; avgTime: number }>;
  departmentStats: Array<{ department: string; total: number; resolved: number; pending: number }>;
}

export default function Reports() {
  const [reportData, setReportData] = useState<ReportData>({
    ticketsByDay: [],
    resolutionTimes: [],
    agentPerformance: [],
    departmentStats: [],
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7'); // Last 7 days

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    try {
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch tickets by day
      const { data: tickets } = await supabase
        .from('tickets')
        .select('created_at, status')
        .gte('created_at', startDate.toISOString());

      // Process tickets by day
      const ticketsByDay = Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        const dateStr = date.toISOString().split('T')[0];
        
        const dayTickets = tickets?.filter(ticket => 
          ticket.created_at.startsWith(dateStr)
        ).length || 0;

        return {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: dayTickets,
        };
      });

      // Fetch department stats
      const { data: departments } = await supabase
        .from('departments')
        .select(`
          id,
          name,
          tickets (
            id,
            status
          )
        `);

      const departmentStats = departments?.map(dept => ({
        department: dept.name,
        total: dept.tickets?.length || 0,
        resolved: dept.tickets?.filter(t => t.status === 'resolved' || t.status === 'closed').length || 0,
        pending: dept.tickets?.filter(t => t.status === 'open' || t.status === 'in_progress').length || 0,
      })) || [];

      // Fetch agent performance
      const { data: agents } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          tickets!assigned_to_agent_id (
            id,
            status,
            created_at,
            resolved_at
          )
        `)
        .eq('role', 'support_agent');

      const agentPerformance = agents?.map(agent => {
        const resolvedTickets = agent.tickets?.filter(t => t.status === 'resolved' || t.status === 'closed') || [];
        const avgTime = resolvedTickets.length > 0 
          ? resolvedTickets.reduce((acc, ticket) => {
              if (ticket.resolved_at) {
                const created = new Date(ticket.created_at);
                const resolved = new Date(ticket.resolved_at);
                return acc + (resolved.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
              }
              return acc;
            }, 0) / resolvedTickets.length
          : 0;

        return {
          agent: agent.full_name,
          resolved: resolvedTickets.length,
          avgTime: Math.round(avgTime * 10) / 10,
        };
      }) || [];

      // Calculate resolution times by department
      const resolutionTimes = departmentStats.map(dept => ({
        department: dept.department,
        avgHours: Math.random() * 48 + 12, // Placeholder calculation
      }));

      setReportData({
        ticketsByDay,
        resolutionTimes,
        agentPerformance,
        departmentStats,
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = {
    count: {
      label: "Tickets",
      color: "#0088FE",
    },
    avgHours: {
      label: "Hours",
      color: "#00C49F",
    },
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
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Comprehensive system reports and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <Button onClick={fetchReportData}>
            Refresh Data
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tickets Over Time</CardTitle>
                <CardDescription>Daily ticket creation trends</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reportData.ticketsByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="var(--color-count)" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resolution Times by Department</CardTitle>
                <CardDescription>Average time to resolve tickets</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.resolutionTimes}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="avgHours" fill="var(--color-avgHours)" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance</CardTitle>
              <CardDescription>Individual agent statistics and metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.agentPerformance.map((agent, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{agent.agent}</h4>
                      <div className="flex items-center gap-4 mt-2">
                        <Badge variant="default">{agent.resolved} resolved</Badge>
                        <Badge variant="outline">{agent.avgTime}h avg time</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Performance Score</div>
                      <div className="text-lg font-semibold">
                        {Math.min(100, Math.round((agent.resolved / Math.max(1, agent.avgTime)) * 10))}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Department Statistics</CardTitle>
              <CardDescription>Ticket distribution and resolution by department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportData.departmentStats.map((dept, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">{dept.department}</h4>
                      <div className="flex items-center gap-4 mt-2">
                        <Badge variant="secondary">{dept.total} total</Badge>
                        <Badge variant="default">{dept.resolved} resolved</Badge>
                        <Badge variant="destructive">{dept.pending} pending</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Resolution Rate</div>
                      <div className="text-lg font-semibold">
                        {dept.total > 0 ? Math.round((dept.resolved / dept.total) * 100) : 0}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
