
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/FileUpload';
import { MessageCircle, Send, Download, Clock } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user: { full_name: string };
  attachments: {
    id: string;
    file_name: string;
    size_bytes: number;
    storage_path: string;
  }[];
}

interface EnhancedCommentsProps {
  ticketId: string;
}

export const EnhancedComments = ({ ticketId }: EnhancedCommentsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<any[]>([]);

  useEffect(() => {
    fetchComments();
    subscribeToComments();
  }, [ticketId]);

  const fetchComments = async () => {
    try {
      const { data: commentsData, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user_id
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user profiles for comments
      const userIds = [...new Set(commentsData.map(comment => comment.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profilesMap = profiles?.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, { full_name: string }>) || {};

      // Fetch attachments for comments
      const commentIds = commentsData.map(c => c.id);
      const { data: attachments } = await supabase
        .from('attachments')
        .select('id, file_name, size_bytes, storage_path, comment_id')
        .in('comment_id', commentIds);

      const attachmentsMap = attachments?.reduce((acc, attachment) => {
        if (!acc[attachment.comment_id]) {
          acc[attachment.comment_id] = [];
        }
        acc[attachment.comment_id].push(attachment);
        return acc;
      }, {} as Record<string, any[]>) || {};

      const commentsWithUsers = commentsData.map(comment => ({
        ...comment,
        user: profilesMap[comment.user_id] || { full_name: 'Unknown User' },
        attachments: attachmentsMap[comment.id] || []
      }));

      setComments(commentsWithUsers);
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
          fetchComments(); // Refetch to get user info and attachments
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;

    setSubmitting(true);
    try {
      const { data: commentData, error } = await supabase
        .from('comments')
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          content: newComment.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update any pending attachments with the comment ID
      if (pendingAttachments.length > 0) {
        const { error: attachmentError } = await supabase
          .from('attachments')
          .update({ comment_id: commentData.id })
          .in('id', pendingAttachments.map(a => a.id));

        if (attachmentError) {
          console.error('Error updating attachments:', attachmentError);
        }
        setPendingAttachments([]);
      }

      setNewComment('');
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUploaded = (file: any) => {
    setPendingAttachments(prev => [...prev, file]);
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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          {comments.map((comment) => (
            <div key={comment.id} className="border-l-4 border-blue-200 pl-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">{comment.user.full_name}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(comment.created_at).toLocaleString()}
                </p>
              </div>
              <p className="whitespace-pre-wrap mb-3">{comment.content}</p>
              
              {comment.attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Attachments:</p>
                  {comment.attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                      <div>
                        <p className="text-sm font-medium">{attachment.file_name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(attachment.size_bytes)}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadFile(attachment.storage_path, attachment.file_name)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4 border-t pt-4">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          
          <FileUpload
            onFileUploaded={handleFileUploaded}
            ticketId={ticketId}
          />
          
          {pendingAttachments.length > 0 && (
            <div className="p-3 bg-blue-50 rounded border">
              <p className="text-sm text-blue-800 mb-2">
                {pendingAttachments.length} file(s) will be attached to this comment
              </p>
              {pendingAttachments.map((file, index) => (
                <p key={index} className="text-xs text-blue-600">{file.file_name}</p>
              ))}
            </div>
          )}
          
          <Button 
            onClick={handleAddComment} 
            disabled={!newComment.trim() || submitting}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {submitting ? 'Adding...' : 'Add Comment'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
