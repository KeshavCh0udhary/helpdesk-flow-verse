
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  isOwnMessage: boolean;
  currentUserId?: string;
}

export const CommentItem = ({ comment, formatFileSize, getRoleColor, isOwnMessage }: CommentItemProps) => {
  const getBubbleStyles = () => {
    if (isOwnMessage) {
      return "bg-blue-500 text-white ml-12 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-md";
    }
    return "bg-gray-100 text-gray-900 mr-12 rounded-tl-md rounded-tr-2xl rounded-bl-2xl rounded-br-2xl";
  };

  const getContainerAlignment = () => {
    return isOwnMessage ? "justify-end" : "justify-start";
  };

  const getBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'support_agent': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`flex ${getContainerAlignment()} mb-3`}>
      {!isOwnMessage && (
        <Avatar className="h-8 w-8 mr-2 flex-shrink-0">
          <AvatarFallback className="text-xs">
            {comment.user.full_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={`max-w-xs lg:max-w-md px-4 py-2 ${getBubbleStyles()}`}>
        {!isOwnMessage && (
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{comment.user.full_name}</span>
            <Badge className={`text-xs ${getBadgeColor(comment.user.role)}`}>
              {comment.user.role.replace('_', ' ')}
            </Badge>
          </div>
        )}
        
        <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
        
        {comment.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {comment.attachments.map((attachment) => (
              <div key={attachment.id} className={`flex items-center gap-2 text-xs p-2 rounded border ${isOwnMessage ? 'bg-blue-400 border-blue-300' : 'bg-white border-gray-200'}`}>
                <Paperclip className="h-3 w-3" />
                <span className="truncate">{attachment.file_name}</span>
                <span className={isOwnMessage ? 'text-blue-100' : 'text-gray-500'}>
                  ({formatFileSize(attachment.size_bytes)})
                </span>
              </div>
            ))}
          </div>
        )}
        
        <div className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'} ${isOwnMessage ? 'text-right' : 'text-left'}`}>
          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
        </div>
      </div>
      
      {isOwnMessage && (
        <Avatar className="h-8 w-8 ml-2 flex-shrink-0">
          <AvatarFallback className="text-xs bg-blue-500 text-white">
            {comment.user.full_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};
