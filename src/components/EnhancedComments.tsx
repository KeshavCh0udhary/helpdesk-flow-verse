import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, Send, Paperclip, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

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
  const { user, profile } = useAuth();
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
        uploaded_by: user?.id
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
        {/* Comments List */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {comment.user.full_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{comment.user.full_name}</span>
                  <span className={`text-xs ${getRoleColor(comment.user.role)}`}>
                    {comment.user.role.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                {comment.attachments.length > 0 && (
                  <div className="space-y-1">
                    {comment.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-2 text-xs bg-white p-2 rounded border">
                        <Paperclip className="h-3 w-3" />
                        <span>{attachment.file_name}</span>
                        <span className="text-gray-500">
                          ({formatFileSize(attachment.size_bytes)})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* New Comment Form */}
        <div className="space-y-3 pt-4 border-t">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          
          {/* File Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Attachments:</p>
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" size="sm" asChild>
                  <span className="cursor-pointer">
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach Files
                  </span>
                </Button>
              </label>
            </div>
            
            <Button 
              onClick={submitComment} 
              disabled={loading || uploading || (!newComment.trim() && attachments.length === 0)}
            >
              <Send className="h-4 w-4 mr-2" />
              {loading || uploading ? 'Posting...' : 'Post Comment'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
