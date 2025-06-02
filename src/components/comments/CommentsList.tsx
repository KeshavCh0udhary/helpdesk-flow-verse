
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
    full_name: string;
    role: string;
  };
  attachments: Attachment[];
}

interface CommentsListProps {
  comments: Comment[];
  formatFileSize: (bytes: number) => string;
  getRoleColor: (role: string) => string;
}

export const CommentsList = ({ comments, formatFileSize, getRoleColor }: CommentsListProps) => {
  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          formatFileSize={formatFileSize}
          getRoleColor={getRoleColor}
        />
      ))}
    </div>
  );
};
