
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Info, FileText, Clock } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  description: string;
}

export default function CreateTicket() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (!error && data) {
      setDepartments(data);
    }
  };

  const validateForm = () => {
    const errors: string[] = [];

    if (!title.trim()) {
      errors.push('Title is required');
    } else if (title.length < 5) {
      errors.push('Title must be at least 5 characters long');
    } else if (title.length > 100) {
      errors.push('Title must be less than 100 characters');
    }

    if (!description.trim()) {
      errors.push('Description is required');
    } else if (description.length < 10) {
      errors.push('Description must be at least 10 characters long');
    } else if (description.length > 2000) {
      errors.push('Description must be less than 2000 characters');
    }

    if (!departmentId) {
      errors.push('Please select a department');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('tickets')
        .insert({
          title: title.trim(),
          description: description.trim(),
          department_id: departmentId,
          priority: priority as 'low' | 'medium' | 'high' | 'urgent',
          created_by_user_id: user?.id,
        });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getCompletionPercentage = () => {
    let completed = 0;
    const total = 4;

    if (title.trim()) completed++;
    if (description.trim()) completed++;
    if (departmentId) completed++;
    if (priority) completed++;

    return (completed / total) * 100;
  };

  const getPriorityInfo = (priority: string) => {
    const info = {
      low: { color: 'text-green-600', description: 'Non-critical issues, general questions' },
      medium: { color: 'text-yellow-600', description: 'Standard issues affecting your work' },
      high: { color: 'text-orange-600', description: 'Important issues blocking your progress' },
      urgent: { color: 'text-red-600', description: 'Critical issues requiring immediate attention' },
    };
    return info[priority as keyof typeof info] || info.medium;
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl text-green-700">Ticket Created Successfully!</CardTitle>
            <CardDescription className="text-lg">
              Your support request has been submitted and will be assigned to an agent shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">What happens next?</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Your ticket will be automatically assigned to an available agent</li>
                  <li>• You'll receive notifications when there are updates</li>
                  <li>• You can track progress on your dashboard</li>
                </ul>
              </div>
              <p className="text-sm text-gray-600">Redirecting to dashboard...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Support Ticket
          </CardTitle>
          <CardDescription>
            Describe your issue and we'll connect you with the right support team
          </CardDescription>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Form Completion</span>
              <span>{Math.round(getCompletionPercentage())}%</span>
            </div>
            <Progress value={getCompletionPercentage()} className="h-2" />
          </div>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {validationErrors.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title Field */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief, descriptive title for your issue"
                className={validationErrors.some(e => e.includes('Title')) ? 'border-red-500' : ''}
                maxLength={100}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Be specific and concise</span>
                <span>{title.length}/100</span>
              </div>
            </div>

            {/* Department Field */}
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className={validationErrors.some(e => e.includes('department')) ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select the relevant department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div>
                        <div className="font-medium">{dept.name}</div>
                        <div className="text-sm text-gray-500">{dept.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Choose the department that best matches your issue
              </p>
            </div>

            {/* Priority Field */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span>Low Priority</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span>Medium Priority</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <span>High Priority</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span>Urgent</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className={getPriorityInfo(priority).color}>
                  <strong>{priority.charAt(0).toUpperCase() + priority.slice(1)} Priority:</strong>{' '}
                  {getPriorityInfo(priority).description}
                </AlertDescription>
              </Alert>
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please provide a detailed description of your issue. Include:
• What you were trying to do
• What actually happened
• Any error messages you received
• Steps to reproduce the issue"
                rows={8}
                className={validationErrors.some(e => e.includes('Description')) ? 'border-red-500' : ''}
                maxLength={2000}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Include as much detail as possible to help us resolve your issue faster</span>
                <span>{description.length}/2000</span>
              </div>
            </div>

            {/* Expected Response Time */}
            {priority && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <strong>Expected Response Time:</strong>{' '}
                  {priority === 'urgent' ? 'Within 1 hour' :
                   priority === 'high' ? 'Within 4 hours' :
                   priority === 'medium' ? 'Within 24 hours' :
                   'Within 48 hours'}
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Buttons */}
            <div className="flex space-x-4">
              <Button 
                type="submit" 
                disabled={loading || getCompletionPercentage() < 100}
                className="flex-1"
              >
                {loading ? 'Creating Ticket...' : 'Create Ticket'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/dashboard')}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>

            {getCompletionPercentage() < 100 && (
              <p className="text-sm text-gray-500 text-center">
                Please complete all required fields to submit your ticket
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
