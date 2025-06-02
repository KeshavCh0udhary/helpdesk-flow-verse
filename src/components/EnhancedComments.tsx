import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Send, Paperclip, X, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AdvancedFileUpload } from './AdvancedFileUpload';
import { CommentsList } from './comments/CommentsList';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_profile?: {
    full_name: string;
    role: string;
  };
  attachments?: Array<{
    id: string;
    file_name: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
  }>;
}

interface EnhancedCommentsProps {
  ticketId: string;
  disableNewComments?: boolean;
}

export const EnhancedComments = ({ ticketId, disableNewComments = false }: EnhancedCommentsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchComments();
    
    // Set up real-time subscription for comments
    const channel = supabase
      .channel(`ticket-comments-${ticketId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `ticket_id=eq.${ticketId}`
      }, () => {
        fetchComments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const fetchComments = async () => {
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      if (commentsData && commentsData.length > 0) {
        // Get user profiles
        const userIds = [...new Set(commentsData.map(comment => comment.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('id', userIds);

        const profilesMap = (profilesData || []).reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>);

        // Get attachments for all comments
        const { data: attachmentsData } = await supabase
          .from('attachments')
          .select('*')
          .in('comment_id', commentsData.map(c => c.id));

        const attachmentsMap = (attachmentsData || []).reduce((acc, attachment) => {
          if (!acc[attachment.comment_id!]) {
            acc[attachment.comment_id!] = [];
          }
          acc[attachment.comment_id!].push(attachment);
          return acc;
        }, {} as Record<string, any[]>);

        const commentsWithProfiles = commentsData.map(comment => ({
          ...comment,
          user_profile: profilesMap[comment.user_id] || { full_name: 'Unknown User', role: 'employee' },
          attachments: attachmentsMap[comment.id] || []
        }));

        setComments(commentsWithProfiles);
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

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || disableNewComments) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          content: newComment.trim()
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

  const handleFileUpload = async (files: Array<{ id: string; file_name: string; size_bytes: number; storage_path: string }>) => {
    console.log('Files uploaded:', files);
    setShowFileUpload(false);
    toast({
      title: "Success",
      description: `${files.length} file(s) uploaded successfully`,
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'support_agent': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Transform comments for the new component structure
  const transformedComments = comments.map(comment => ({
    id: comment.id,
    content: comment.content,
    created_at: comment.created_at,
    user: {
      id: comment.user_id,
      full_name: comment.user_profile?.full_name || 'Unknown User',
      role: comment.user_profile?.role || 'employee'
    },
    attachments: comment.attachments || []
  }));

  if (loading) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600">Loading conversation...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="border-b border-gray-100 bg-gray-50/50">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <MessageCircle className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Conversation</h3>
            <p className="text-sm text-gray-600 font-normal">
              {comments.length > 0 ? (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {comments.length} message{comments.length !== 1 ? 's' : ''}
                </span>
              ) : (
                'No messages yet'
              )}
            </p>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Comments List */}
        <div className="min-h-[400px] max-h-[600px] overflow-y-auto">
          {comments.length === 0 ? (
            <div className="flex items-center justify-center h-full py-16">
              <div className="text-center space-y-3">
                <div className="p-4 bg-gray-50 rounded-full w-fit mx-auto">
                  <MessageCircle className="h-8 w-8 text-gray-400" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-1">No conversation yet</h3>
                  <p className="text-sm text-gray-600">
                    {disableNewComments ? "This ticket has no comments." : "Start the conversation by adding the first comment"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <CommentsList 
                comments={transformedComments}
                formatFileSize={formatFileSize}
                getRoleColor={getRoleBadgeColor}
                currentUserId={user?.id}
              />
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Comment Form */}
        {!disableNewComments && user && (
          <div className="border-t border-gray-100 bg-gray-50/30 p-4">
            <form onSubmit={handleSubmitComment} className="space-y-3">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Type your message..."
                rows={3}
                className="resize-none border-gray-200 focus:border-blue-300 focus:ring-blue-200"
                required
              />
              
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFileUpload(!showFileUpload)}
                  className="bg-white hover:bg-gray-50"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach Files
                </Button>
                
                <Button 
                  type="submit" 
                  disabled={submitting || !newComment.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {submitting ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
              
              {showFileUpload && (
                <div className="border-t pt-3 mt-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Attach Files</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFileUpload(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <AdvancedFileUpload
                    onFilesUploaded={handleFileUpload}
                    ticketId={ticketId}
                    maxFiles={5}
                    maxFileSize={10}
                  />
                </div>
              )}
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
