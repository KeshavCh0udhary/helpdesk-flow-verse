import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Users, Trash2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

interface Agent {
  id: string;
  full_name: string;
  email: string;
  department: { name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

export default function AddAgent() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchAgents();
      fetchDepartments();
    }
  }, [profile]);

  const fetchAgents = async () => {
    try {
      const { data: agentsData, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          department:departments(name)
        `)
        .eq('role', 'support_agent');

      if (error) throw error;
      setAgents(agentsData || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const validatePasswords = () => {
    if (useCustomPassword) {
      if (!password || password.length < 6) {
        toast({
          title: "Error",
          description: "Password must be at least 6 characters long",
          variant: "destructive",
        });
        return false;
      }
      if (password !== confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        });
        return false;
      }
    }
    return true;
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName || !selectedDepartment) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!validatePasswords()) return;

    setSubmitting(true);
    try {
      console.log('Calling create-agent function with:', { 
        email, 
        fullName, 
        departmentId: selectedDepartment,
        useCustomPassword,
        password: useCustomPassword ? password : undefined
      });

      const { data, error } = await supabase.functions.invoke('create-agent', {
        body: {
          email,
          fullName,
          departmentId: selectedDepartment,
          useCustomPassword,
          password: useCustomPassword ? password : undefined,
        },
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Function error:', error);
        throw new Error(error.message || 'Failed to create agent');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const successMessage = useCustomPassword 
        ? "Support agent added successfully with custom password!"
        : "Support agent added successfully! They will receive an email with instructions to set up their password.";

      toast({
        title: "Success",
        description: successMessage,
      });

      setEmail('');
      setFullName('');
      setSelectedDepartment('');
      setPassword('');
      setConfirmPassword('');
      setUseCustomPassword(false);
      fetchAgents();
    } catch (error: any) {
      console.error('Error adding agent:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add support agent",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to remove this agent?')) return;

    try {
      // For now, we'll just remove their agent role and department
      // In production, you might want a separate Edge Function for this
      const { error } = await supabase
        .from('profiles')
        .update({
          role: 'employee',
          department_id: null,
        })
        .eq('id', agentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Agent role removed successfully",
      });
      fetchAgents();
    } catch (error: any) {
      console.error('Error removing agent:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove agent",
        variant: "destructive",
      });
    }
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
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Manage Support Agents</h1>
        <p className="text-gray-600">Add and manage support agents for your helpdesk</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add New Agent
            </CardTitle>
            <CardDescription>
              Create a new support agent account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddAgent} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div>
                <Label htmlFor="department">Department</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="useCustomPassword"
                  checked={useCustomPassword}
                  onCheckedChange={(checked) => setUseCustomPassword(checked as boolean)}
                />
                <Label htmlFor="useCustomPassword" className="text-sm">
                  Set custom password (instead of sending setup email)
                </Label>
              </div>

              {useCustomPassword && (
                <>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password (min 6 characters)"
                        required={useCustomPassword}
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      required={useCustomPassword}
                    />
                  </div>
                </>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Adding...' : 'Add Agent'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Current Agents ({agents.length})
            </CardTitle>
            <CardDescription>
              Manage existing support agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No agents yet</h3>
                <p className="text-gray-600">Add your first support agent to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{agent.full_name}</p>
                      <p className="text-sm text-gray-500">{agent.email}</p>
                      {agent.department && (
                        <Badge variant="outline" className="mt-1">
                          {agent.department.name}
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveAgent(agent.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
