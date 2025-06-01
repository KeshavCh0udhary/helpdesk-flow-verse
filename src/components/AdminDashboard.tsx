
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Settings, BarChart3, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';
import { StatsOverview } from '@/components/admin/StatsOverview';
import { QuickActions } from '@/components/admin/QuickActions';
import { SystemStatus } from '@/components/admin/SystemStatus';
import { PatternInsights } from '@/components/ai/PatternInsights';
import { KnowledgeBaseManager } from '@/components/ai/KnowledgeBaseManager';

interface Stats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  totalAgents: number;
  totalEmployees: number;
}

export const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
    totalAgents: 0,
    totalEmployees: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch ticket stats
      const { data: tickets } = await supabase
        .from('tickets')
        .select('status');

      // Fetch user stats
      const { data: profiles } = await supabase
        .from('profiles')
        .select('role');

      if (tickets && profiles) {
        setStats({
          totalTickets: tickets.length,
          openTickets: tickets.filter(t => t.status === 'open').length,
          inProgressTickets: tickets.filter(t => t.status === 'in_progress').length,
          resolvedTickets: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
          totalAgents: profiles.filter(p => p.role === 'support_agent').length,
          totalEmployees: profiles.filter(p => p.role === 'employee').length,
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
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
      <div className="flex flex-col space-y-4 mb-6 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Overview of your AI-powered helpdesk system</p>
        </div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          <Link to="/admin/add-agent">
            <Button className="w-full sm:w-auto">
              <Users className="h-4 w-4 mr-2" />
              <span className="sm:hidden">Add Agent</span>
              <span className="hidden sm:inline">Add Agent</span>
            </Button>
          </Link>
          <Link to="/knowledge-base">
            <Button variant="outline" className="w-full sm:w-auto">
              <Bot className="h-4 w-4 mr-2" />
              <span className="sm:hidden">Knowledge Base</span>
              <span className="hidden sm:inline">Manage Knowledge Base</span>
            </Button>
          </Link>
          <Link to="/admin/department-management">
            <Button variant="outline" className="w-full sm:w-auto">
              <Settings className="h-4 w-4 mr-2" />
              <span className="sm:hidden">Departments</span>
              <span className="hidden sm:inline">Manage Departments</span>
            </Button>
          </Link>
          <Link to="/admin/queue-management">
            <Button variant="outline" className="w-full sm:w-auto">
              <BarChart3 className="h-4 w-4 mr-2" />
              <span className="sm:hidden">Queues</span>
              <span className="hidden sm:inline">Manage Queues</span>
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
          <TabsTrigger value="knowledge-base">Knowledge Base</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <StatsOverview stats={stats} />

          <div className="grid gap-6 md:grid-cols-2">
            <QuickActions />
            <SystemStatus stats={stats} />
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsDashboard />
        </TabsContent>

        <TabsContent value="ai-insights" className="space-y-6">
          <PatternInsights />
        </TabsContent>

        <TabsContent value="knowledge-base">
          <KnowledgeBaseManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};
