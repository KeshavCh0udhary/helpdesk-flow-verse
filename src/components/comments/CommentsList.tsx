
import { CommentItem } from './CommentItem';

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
    id: string;
    full_name: string;
    role: string;
  };
  attachments: Attachment[];
}

interface CommentsListProps {
  comments: Comment[];
  formatFileSize: (bytes: number) => string;
  getRoleColor: (role: string) => string;
  currentUserId?: string;
}

export const CommentsList = ({ comments, formatFileSize, getRoleColor, currentUserId }: CommentsListProps) => {
  return (
    <div className="space-y-1 max-h-96 overflow-y-auto p-3 bg-gray-50 rounded-lg">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          formatFileSize={formatFileSize}
          getRoleColor={getRoleColor}
          isOwnMessage={comment.user.id === currentUserId}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
};
