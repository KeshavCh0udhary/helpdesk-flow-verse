
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Paperclip } from 'lucide-react';

interface Attachment {
  id: string;
  file_name: string;
  size_bytes: number;
  storage_path: string;
}

interface TicketAttachmentsProps {
  attachments: Attachment[];
  formatFileSize: (bytes: number) => string;
  onDownloadFile: (storagePath: string, fileName: string) => void;
}

export const TicketAttachments = ({ attachments, formatFileSize, onDownloadFile }: TicketAttachmentsProps) => {
  if (attachments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Attachments ({attachments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <p className="font-medium">{attachment.file_name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(attachment.size_bytes)}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onDownloadFile(attachment.storage_path, attachment.file_name)}
              >
                Download
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
