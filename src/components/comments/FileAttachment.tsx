
import { Button } from '@/components/ui/button';
import { Paperclip, X } from 'lucide-react';

interface FileAttachmentProps {
  attachments: File[];
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (index: number) => void;
}

export const FileAttachment = ({ attachments, onFileSelect, onRemoveAttachment }: FileAttachmentProps) => {
  return (
    <>
      {/* File Attachments Display */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Attachments:</p>
          {attachments.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveAttachment(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* File Upload Input */}
      <div className="flex items-center gap-2">
        <input
          type="file"
          multiple
          onChange={onFileSelect}
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
    </>
  );
};
