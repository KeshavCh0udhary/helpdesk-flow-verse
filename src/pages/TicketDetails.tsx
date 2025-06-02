import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Paperclip } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { EnhancedComments } from '@/components/EnhancedComments';
import { ResponseSuggestions } from '@/components/ai/ResponseSuggestions';
import { AIAnswerBot } from '@/components/ai/AIAnswerBot';
import { getPriorityColorClasses, getStatusColorClasses } from '@/utils/colorUtils';

type TicketStatus = Database['public']['Enums']['ticket_status'];
type TicketPriority = Database['public']['Enums']['ticket_priority'];

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  created_by_user: { full_name: string };
  assigned_to_agent: { full_name: string } | null;
  department: { name: string };
}

interface Attachment {
  id: string;
  file_name: string;
  size_bytes: number;
  created_at: string;
  storage_path: string;
}

export default function TicketDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTicketDetails();
      fetchAttachments();
    }
  }, [id]);

  const fetchTicketDetails = async () => {
    try {
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          created_at,
          created_by_user_id,
          assigned_to_agent_id,
          department:departments(name)
        `)
        .eq('id', id)
        .single();

      if (ticketError) throw ticketError;

      // Fetch user profiles
      const userIds = [ticketData.created_by_user_id, ticketData.assigned_to_agent_id].filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profilesMap = profiles?.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, { full_name: string }>) || {};

      setTicket({
        ...ticketData,
        created_by_user: profilesMap[ticketData.created_by_user_id] || { full_name: 'Unknown User' },
        assigned_to_agent: ticketData.assigned_to_agent_id ? profilesMap[ticketData.assigned_to_agent_id] : null,
      });
    } catch (error) {
      console.error('Error fetching ticket:', error);
      toast({
        title: "Error",
        description: "Failed to load ticket details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('attachments')
        .select('id, file_name, size_bytes, created_at, storage_path')
        .eq('ticket_id', id)
        .is('comment_id', null);

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          status: newStatus,
          resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null
        })
        .eq('id', id);

      if (error) throw error;

      fetchTicketDetails();
      toast({
        title: "Success",
        description: "Ticket status updated",
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update ticket status",
        variant: "destructive",
      });
    }
  };

  const downloadFile = async (storagePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .download(storagePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleResponseSelect = (content: string) => {
    // This will be handled by the EnhancedComments component
    const event = new CustomEvent('insertResponse', { detail: content });
    window.dispatchEvent(event);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ticket Not Found</h1>
          <Link to="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const canModifyTicket = profile?.role === 'support_agent' || profile?.role === 'admin';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <Link to="/tickets">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tickets
          </Button>
        </Link>
        
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{ticket.title}</h1>
            <p className="text-gray-600">Ticket #{ticket.id.slice(0, 8)}</p>
          </div>
          
          <div className="flex gap-2">
            <Badge className={getStatusColorClasses(ticket.status)}>
              {ticket.status.replace('_', ' ')}
            </Badge>
            <Badge className={getPriorityColorClasses(ticket.priority)}>
              {ticket.priority}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500">Created by</p>
            <p className="font-medium">{ticket.created_by_user.full_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Department</p>
            <p className="font-medium">{ticket.department.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Assigned to</p>
            <p className="font-medium">{ticket.assigned_to_agent?.full_name || 'Unassigned'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          {attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments ({attachments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{attachment.file_name}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(attachment.size_bytes)}</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => downloadFile(attachment.storage_path, attachment.file_name)}
                      >
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <EnhancedComments ticketId={ticket.id} />
        </div>

        <div className="space-y-6">
          {canModifyTicket && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select value={ticket.status} onValueChange={handleStatusChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium">{new Date(ticket.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Priority</p>
                <Badge className={getPriorityColorClasses(ticket.priority)}>
                  {ticket.priority}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Department</p>
                <p className="font-medium">{ticket.department.name}</p>
              </div>
            </CardContent>
          </Card>

          {canModifyTicket && (
            <Card>
              <CardHeader>
                <CardTitle>AI Tools</CardTitle>
                <CardDescription>AI-powered assistance for ticket resolution</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="suggestions" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="suggestions">Response</TabsTrigger>
                    <TabsTrigger value="bot">Ask AI</TabsTrigger>
                  </TabsList>
                  <TabsContent value="suggestions" className="mt-4">
                    <ResponseSuggestions 
                      ticketId={ticket.id} 
                      onSelectResponse={handleResponseSelect} 
                    />
                  </TabsContent>
                  <TabsContent value="bot" className="mt-4">
                    <AIAnswerBot />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
