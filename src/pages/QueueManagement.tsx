
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Users, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

interface Agent {
  id: string;
  full_name: string;
  email: string;
}

interface Department {
  id: string;
  name: string;
  agents: Agent[];
  queue_order: string[];
  current_index: number;
}

export default function QueueManagement() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchDepartments();
    }
  }, [profile]);

  const fetchDepartments = async () => {
    try {
      // Fetch departments with their agents
      const { data: departmentsData, error: deptError } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');

      if (deptError) throw deptError;

      // Fetch agents for each department
      const departmentsWithAgents = await Promise.all(
        departmentsData.map(async (dept) => {
          const { data: agentsData } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('department_id', dept.id)
            .eq('role', 'support_agent');

          // Fetch queue information
          const { data: queueData } = await supabase
            .from('agent_queue')
            .select('ordered_agent_ids, current_index')
            .eq('department_id', dept.id)
            .single();

          return {
            ...dept,
            agents: agentsData || [],
            queue_order: queueData?.ordered_agent_ids || [],
            current_index: queueData?.current_index || 0,
          };
        })
      );

      setDepartments(departmentsWithAgents);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQueue = async (departmentId: string, newOrder: string[], currentIndex?: number) => {
    try {
      const { error } = await supabase
        .from('agent_queue')
        .upsert({
          department_id: departmentId,
          ordered_agent_ids: newOrder,
          current_index: currentIndex !== undefined ? currentIndex : 0,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Queue order updated successfully",
      });

      fetchDepartments();
    } catch (error: any) {
      console.error('Error updating queue:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update queue",
        variant: "destructive",
      });
    }
  };

  const moveAgent = (departmentId: string, fromIndex: number, toIndex: number) => {
    const department = departments.find(d => d.id === departmentId);
    if (!department) return;

    const newOrder = [...department.queue_order];
    const [movedAgent] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedAgent);

    updateQueue(departmentId, newOrder, department.current_index);
  };

  const resetQueue = (departmentId: string) => {
    updateQueue(departmentId, [], 0);
  };

  const initializeQueue = (departmentId: string) => {
    const department = departments.find(d => d.id === departmentId);
    if (!department) return;

    const agentIds = department.agents.map(agent => agent.id);
    updateQueue(departmentId, agentIds, 0);
  };

  const getAgentByIndex = (department: Department, index: number): Agent | null => {
    const agentId = department.queue_order[index];
    return department.agents.find(agent => agent.id === agentId) || null;
  };

  if (profile?.role !== 'admin') {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Queue Management</h1>
        <p className="text-gray-600">Manage agent assignment queues for each department</p>
      </div>

      <div className="grid gap-6">
        {departments.map((department) => (
          <Card key={department.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    {department.name}
                  </CardTitle>
                  <CardDescription>
                    {department.agents.length} agents • Queue position: {department.current_index + 1}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => initializeQueue(department.id)}
                    disabled={department.queue_order.length > 0}
                  >
                    Initialize Queue
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetQueue(department.id)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {department.agents.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No agents in this department</h3>
                  <p className="text-gray-600">Add agents to this department to set up the queue</p>
                </div>
              ) : department.queue_order.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Queue not initialized</h3>
                  <p className="text-gray-600 mb-4">Initialize the queue to start assigning tickets</p>
                  <Button onClick={() => initializeQueue(department.id)}>
                    Initialize Queue
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Current Queue Order:</h4>
                    <div className="space-y-2">
                      {department.queue_order.map((agentId, index) => {
                        const agent = getAgentByIndex(department, index);
                        const isNext = index === department.current_index;
                        
                        return (
                          <div
                            key={agentId}
                            className={`flex items-center justify-between p-3 border rounded-lg ${
                              isNext ? 'border-blue-500 bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium w-8">#{index + 1}</span>
                              <div>
                                <p className="font-medium">{agent?.full_name || 'Unknown Agent'}</p>
                                <p className="text-sm text-gray-500">{agent?.email}</p>
                              </div>
                              {isNext && (
                                <Badge variant="default">Next</Badge>
                              )}
                            </div>
                            
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => moveAgent(department.id, index, Math.max(0, index - 1))}
                                disabled={index === 0}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => moveAgent(department.id, index, Math.min(department.queue_order.length - 1, index + 1))}
                                disabled={index === department.queue_order.length - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
