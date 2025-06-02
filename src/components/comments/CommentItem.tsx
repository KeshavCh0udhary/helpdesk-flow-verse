
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Paperclip } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Attachment {
  id: string;
  file_name: string;
  size_bytes: number;
  storage_path: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user: {
    full_name: string;
    role: string;
  };
  attachments: Attachment[];
}

interface CommentItemProps {
  comment: Comment;
  formatFileSize: (bytes: number) => string;
  getRoleColor: (role: string) => string;
}

export const CommentItem = ({ comment, formatFileSize, getRoleColor }: CommentItemProps) => {
  return (
    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
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
  );
};
