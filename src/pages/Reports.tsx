
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Download, Calendar } from 'lucide-react';
import { TicketTrends } from '@/components/reports/TicketTrends';
import { ResolutionMetrics } from '@/components/reports/ResolutionMetrics';
import { AgentPerformance } from '@/components/reports/AgentPerformance';
import { DepartmentAnalytics } from '@/components/reports/DepartmentAnalytics';
import { PatternInsights } from '@/components/ai/PatternInsights';

interface ReportData {
  ticketsByDay: Array<{ date: string; count: number }>;
  resolutionTimes: Array<{ department: string; avgHours: number; totalResolved: number }>;
  agentPerformance: Array<{ agent: string; resolved: number; avgTime: number; satisfaction?: number }>;
  departmentStats: Array<{ 
    department: string; 
    total: number; 
    resolved: number; 
    pending: number; 
    resolutionRate: number;
  }>;
}

export default function Reports() {
  const { profile } = useAuth();
  const [reportData, setReportData] = useState<ReportData>({
    ticketsByDay: [],
    resolutionTimes: [],
    agentPerformance: [],
    departmentStats: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => {
    fetchReportData();
  }, [dateRange, profile]);

  const fetchReportData = async () => {
    try {
      setRefreshing(true);
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Build base query with department filter for agents
      let ticketsQuery = supabase
        .from('tickets')
        .select('created_at, status, department_id')
        .gte('created_at', startDate.toISOString());

      // Filter by department for support agents
      if (profile?.role === 'support_agent' && profile?.department_id) {
        ticketsQuery = ticketsQuery.eq('department_id', profile.department_id);
      }

      const { data: tickets } = await ticketsQuery;

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

      // Fetch department stats with filtering
      let departmentsQuery = supabase
        .from('departments')
        .select(`
          id,
          name,
          tickets (
            id,
            status,
            created_at,
            resolved_at
          )
        `);

      // Filter departments for support agents
      if (profile?.role === 'support_agent' && profile?.department_id) {
        departmentsQuery = departmentsQuery.eq('id', profile.department_id);
      }

      const { data: departments } = await departmentsQuery;

      const departmentStats = departments?.map(dept => {
        const total = dept.tickets?.length || 0;
        const resolved = dept.tickets?.filter(t => t.status === 'resolved' || t.status === 'closed').length || 0;
        const pending = dept.tickets?.filter(t => t.status === 'open' || t.status === 'in_progress').length || 0;
        const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
        
        return {
          department: dept.name,
          total,
          resolved,
          pending,
          resolutionRate,
        };
      }) || [];

      // Calculate resolution times by department
      const resolutionTimes = departmentStats.map(dept => {
        const deptTickets = departments?.find(d => d.name === dept.department)?.tickets || [];
        const resolvedTickets = deptTickets.filter(t => t.resolved_at && t.created_at);
        
        let avgHours = 0;
        if (resolvedTickets.length > 0) {
          const totalHours = resolvedTickets.reduce((sum, ticket) => {
            const created = new Date(ticket.created_at);
            const resolved = new Date(ticket.resolved_at);
            return sum + (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
          }, 0);
          avgHours = Math.round((totalHours / resolvedTickets.length) * 10) / 10;
        }
        
        return {
          department: dept.department,
          avgHours,
          totalResolved: dept.resolved,
        };
      });

      // Enhanced agent performance data with department filtering
      let agentTicketsQuery = supabase
        .from('tickets')
        .select(`
          assigned_to_agent_id,
          status,
          created_at,
          resolved_at,
          department_id
        `)
        .not('assigned_to_agent_id', 'is', null)
        .gte('created_at', startDate.toISOString());

      // Filter by department for support agents
      if (profile?.role === 'support_agent' && profile?.department_id) {
        agentTicketsQuery = agentTicketsQuery.eq('department_id', profile.department_id);
      }

      const { data: agentTickets } = await agentTicketsQuery;

      const agentIds = [...new Set(agentTickets?.map(t => t.assigned_to_agent_id).filter(Boolean))];
      const { data: agentProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', agentIds);

      const agentNameMap = new Map();
      agentProfiles?.forEach(profile => {
        agentNameMap.set(profile.id, profile.full_name);
      });

      const agentMap = new Map();
      
      agentTickets?.forEach(ticket => {
        const agentId = ticket.assigned_to_agent_id;
        const agentName = agentNameMap.get(agentId) || 'Unknown Agent';
        
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, {
            agent: agentName,
            resolved: 0,
            totalTime: 0,
            resolvedCount: 0,
            totalAssigned: 0,
          });
        }
        
        const agentData = agentMap.get(agentId);
        agentData.totalAssigned++;
        
        if (ticket.status === 'resolved' || ticket.status === 'closed') {
          agentData.resolved++;
          
          if (ticket.resolved_at) {
            const created = new Date(ticket.created_at);
            const resolved = new Date(ticket.resolved_at);
            const timeHours = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60);
            agentData.totalTime += timeHours;
            agentData.resolvedCount++;
          }
        }
      });

      const agentPerformance = Array.from(agentMap.values()).map(agent => ({
        agent: agent.agent,
        resolved: agent.resolved,
        avgTime: agent.resolvedCount > 0 ? Math.round((agent.totalTime / agent.resolvedCount) * 10) / 10 : 0,
        satisfaction: Math.floor(Math.random() * 2) + 4, // Placeholder: 4.0-5.0 rating
      })).filter(agent => agent.resolved > 0); // Only show agents with resolved tickets

      setReportData({
        ticketsByDay,
        resolutionTimes: resolutionTimes.filter(rt => rt.totalResolved > 0),
        agentPerformance,
        departmentStats,
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const exportReport = () => {
    const reportJson = JSON.stringify(reportData, null, 2);
    const blob = new Blob([reportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getReportsTitle = () => {
    if (profile?.role === 'support_agent') {
      return 'Department Analytics & Reports';
    }
    return 'Analytics & Reports';
  };

  const getReportsDescription = () => {
    if (profile?.role === 'support_agent') {
      return 'Performance insights and metrics for your department';
    }
    return 'Comprehensive insights and performance metrics';
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
          <h1 className="text-3xl font-bold text-gray-900">{getReportsTitle()}</h1>
          <p className="text-gray-600">{getReportsDescription()}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportReport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={fetchReportData} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6">
            <TicketTrends data={reportData.ticketsByDay} />
            <div className="grid gap-6 md:grid-cols-2">
              <ResolutionMetrics data={reportData.resolutionTimes} />
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                  <CardDescription>Overall system performance indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Average Resolution Time</span>
                      <span className="font-semibold">
                        {reportData.resolutionTimes.length > 0 
                          ? (reportData.resolutionTimes.reduce((sum, rt) => sum + rt.avgHours, 0) / reportData.resolutionTimes.length).toFixed(1)
                          : '0'
                        }h
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Active Agents</span>
                      <span className="font-semibold">{reportData.agentPerformance.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Total Resolved</span>
                      <span className="font-semibold">
                        {reportData.agentPerformance.reduce((sum, agent) => sum + agent.resolved, 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <AgentPerformance data={reportData.agentPerformance} />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentAnalytics data={reportData.departmentStats} />
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid gap-6">
            <TicketTrends data={reportData.ticketsByDay} />
            <ResolutionMetrics data={reportData.resolutionTimes} />
          </div>
        </TabsContent>

        <TabsContent value="ai-insights">
          <PatternInsights />
        </TabsContent>
      </Tabs>
    </div>
  );
}
