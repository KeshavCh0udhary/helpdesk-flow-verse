
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';
import { EnhancedComments } from '@/components/EnhancedComments';
import { TicketHeader } from '@/components/tickets/TicketHeader';
import { TicketInfo } from '@/components/tickets/TicketInfo';
import { TicketDescription } from '@/components/tickets/TicketDescription';
import { TicketAttachments } from '@/components/tickets/TicketAttachments';
import { TicketActions } from '@/components/tickets/TicketActions';
import { TicketSidebar } from '@/components/tickets/TicketSidebar';
import { AIToolsPanel } from '@/components/tickets/AIToolsPanel';

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
      <TicketHeader ticket={ticket} />
      <TicketInfo ticket={ticket} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TicketDescription description={ticket.description} />
          
          <TicketAttachments 
            attachments={attachments}
            formatFileSize={formatFileSize}
            onDownloadFile={downloadFile}
          />

          <EnhancedComments ticketId={ticket.id} />
        </div>

        <div className="space-y-6">
          <TicketActions 
            status={ticket.status}
            onStatusChange={handleStatusChange}
            canModifyTicket={canModifyTicket}
          />

          <TicketSidebar ticket={ticket} />

          <AIToolsPanel 
            ticketId={ticket.id}
            onResponseSelect={handleResponseSelect}
            canModifyTicket={canModifyTicket}
          />
        </div>
      </div>
    </div>
  );
}
