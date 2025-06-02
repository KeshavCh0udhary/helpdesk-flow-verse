
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CommentsList } from './comments/CommentsList';
import { CommentForm } from './comments/CommentForm';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user: {
    full_name: string;
    role: string;
  };
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
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => {
    fetchComments();
    
    // Listen for response insertion events
    const handleResponseInsert = (event: CustomEvent) => {
      setNewComment(event.detail);
    };
    
    window.addEventListener('insertResponse', handleResponseInsert as EventListener);
    
    return () => {
      window.removeEventListener('insertResponse', handleResponseInsert as EventListener);
    };
  }, [ticketId]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          attachments:attachments(
            id,
            file_name,
            size_bytes,
            storage_path
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user profiles
      const userIds = data?.map(comment => comment.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', userIds);

      const profilesMap = profiles?.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, { full_name: string; role: string }>) || {};

      const commentsWithUsers = data?.map(comment => ({
        ...comment,
        user: profilesMap[comment.user_id] || { full_name: 'Unknown User', role: 'unknown' }
      })) || [];

      setComments(commentsWithUsers);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const uploadFile = async (file: File, commentId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `comments/${commentId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Save attachment record
    const { error: attachmentError } = await supabase
      .from('attachments')
      .insert({
        file_name: file.name,
        storage_path: filePath,
        size_bytes: file.size,
        ticket_id: ticketId,
        comment_id: commentId,
        uploaded_by_user_id: user?.id
      });

    if (attachmentError) throw attachmentError;

    return filePath;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const submitComment = async () => {
    if (!newComment.trim() && attachments.length === 0) return;

    setLoading(true);
    try {
      // Create comment
      const { data: comment, error: commentError } = await supabase
        .from('comments')
        .insert({
          ticket_id: ticketId,
          content: newComment.trim(),
          user_id: user?.id
        })
        .select()
        .single();

      if (commentError) throw commentError;

      // Upload attachments if any
      if (attachments.length > 0) {
        setUploading(true);
        for (const file of attachments) {
          await uploadFile(file, comment.id);
        }
        setUploading(false);
      }

      setNewComment('');
      setAttachments([]);
      await fetchComments();

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
      setLoading(false);
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-red-600';
      case 'support_agent': return 'text-blue-600';
      case 'employee': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Comments ({comments.length})
        </CardTitle>
        <CardDescription>
          Communicate with team members about this ticket
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CommentsList
          comments={comments}
          formatFileSize={formatFileSize}
          getRoleColor={getRoleColor}
        />

        <CommentForm
          newComment={newComment}
          setNewComment={setNewComment}
          attachments={attachments}
          onFileSelect={handleFileSelect}
          onRemoveAttachment={removeAttachment}
          onSubmit={submitComment}
          loading={loading}
          uploading={uploading}
        />
      </CardContent>
    </Card>
  );
};
