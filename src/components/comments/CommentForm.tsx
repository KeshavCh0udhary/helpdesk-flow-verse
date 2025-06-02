
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { FileAttachment } from './FileAttachment';

interface CommentFormProps {
  newComment: string;
  setNewComment: (value: string) => void;
  attachments: File[];
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (index: number) => void;
  onSubmit: () => void;
  loading: boolean;
  uploading: boolean;
}

export const CommentForm = ({
  newComment,
  setNewComment,
  attachments,
  onFileSelect,
  onRemoveAttachment,
  onSubmit,
  loading,
  uploading
}: CommentFormProps) => {
  return (
    <div className="space-y-3 pt-4 border-t">
      <Textarea
        placeholder="Add a comment..."
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        rows={3}
      />
      
      <FileAttachment
        attachments={attachments}
        onFileSelect={onFileSelect}
        onRemoveAttachment={onRemoveAttachment}
      />

      <div className="flex items-center justify-between">
        <div /> {/* Spacer */}
        
        <Button 
          onClick={onSubmit} 
          disabled={loading || uploading || (!newComment.trim() && attachments.length === 0)}
        >
          <Send className="h-4 w-4 mr-2" />
          {loading || uploading ? 'Posting...' : 'Post Comment'}
        </Button>
      </div>
    </div>
  );
};
