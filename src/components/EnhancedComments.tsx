
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { FileUpload } from './FileUpload';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user: {
    full_name: string;
    role: string;
  };
  attachments?: Array<{
    id: string;
    file_name: string;
    storage_path: string;
  }>;
}

interface Ticket {
  id: string;
  title: string;
  status: string;
}

interface EnhancedCommentsProps {
  ticketId: string;
  ticket?: Ticket;
}

export const EnhancedComments = ({ ticketId, ticket }: EnhancedCommentsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);

  // Check if comments should be disabled (when ticket is closed)
  const isCommentsDisabled = ticket?.status === 'closed';

  useEffect(() => {
    if (ticketId) {
      fetchComments();
      subscribeToComments();
    }
  }, [ticketId]);

  const fetchComments = async () => {
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user_id
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      if (commentsData) {
        // Get user profiles
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('id', userIds);

        const profilesMap = (profilesData || []).reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, { full_name: string; role: string }>);

        // Get attachments for comments
        const commentIds = commentsData.map(c => c.id);
        const { data: attachmentsData } = await supabase
          .from('attachments')
          .select('id, file_name, storage_path, comment_id')
          .in('comment_id', commentIds);

        const attachmentsMap = (attachmentsData || []).reduce((acc, attachment) => {
          if (!acc[attachment.comment_id]) {
            acc[attachment.comment_id] = [];
          }
          acc[attachment.comment_id].push(attachment);
          return acc;
        }, {} as Record<string, any[]>);

        const commentsWithUsers = commentsData.map(comment => ({
          ...comment,
          user: profilesMap[comment.user_id] || { full_name: 'Unknown User', role: 'employee' },
          attachments: attachmentsMap[comment.id] || []
        }));

        setComments(commentsWithUsers);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToComments = () => {
    const channel = supabase
      .channel('comments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `ticket_id=eq.${ticketId}`
        },
        () => {
          fetchComments(); // Refetch comments when new one is added
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          ticket_id: ticketId,
          content: newComment.trim(),
          user_id: user.id
        });

      if (error) throw error;

      setNewComment('');
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    // Handle file upload logic here
    console.log('Files uploaded:', files);
    setShowFileUpload(false);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'support_agent': return 'default';
      case 'employee': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comments List */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              No comments yet. {isCommentsDisabled ? 'Ticket is closed.' : 'Be the first to comment!'}
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 p-4 bg-gray-50 rounded-lg">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {comment.user.full_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{comment.user.full_name}</span>
                    <Badge variant={getRoleBadgeColor(comment.user.role)} className="text-xs">
                      {comment.user.role.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                  {comment.attachments && comment.attachments.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-1">Attachments:</p>
                      {comment.attachments.map((attachment) => (
                        <div key={attachment.id} className="text-xs text-blue-600">
                          {attachment.file_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Comment Form */}
        {!isCommentsDisabled && user && (
          <div className="space-y-3 pt-4 border-t">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              disabled={submitting}
            />
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFileUpload(!showFileUpload)}
                disabled={submitting}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Attach Files
              </Button>
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submitting}
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </div>
            {showFileUpload && (
              <FileUpload
                ticketId={ticketId}
                onUploadComplete={handleFileUpload}
                maxFiles={5}
              />
            )}
          </div>
        )}

        {isCommentsDisabled && (
          <div className="pt-4 border-t">
            <p className="text-center text-gray-500 text-sm">
              Comments are disabled because this ticket is closed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
