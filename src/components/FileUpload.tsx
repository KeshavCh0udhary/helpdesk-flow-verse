
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Paperclip, X, Upload } from 'lucide-react';

interface FileUploadProps {
  onFileUploaded: (file: { id: string; file_name: string; size_bytes: number; storage_path: string }) => void;
  ticketId?: string;
  commentId?: string;
  maxFileSize?: number; // in MB
  allowedTypes?: string[];
}

export const FileUpload = ({ 
  onFileUploaded, 
  ticketId, 
  commentId, 
  maxFileSize = 10,
  allowedTypes = ['image/*', 'application/pdf', '.doc', '.docx', '.txt']
}: FileUploadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      if (file.size > maxFileSize * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than ${maxFileSize}MB`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (!user || selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${file.name}`;
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save attachment record to database
        const { data: attachmentData, error: attachmentError } = await supabase
          .from('attachments')
          .insert({
            file_name: file.name,
            storage_path: uploadData.path,
            size_bytes: file.size,
            mime_type: file.type,
            uploaded_by_user_id: user.id,
            ticket_id: ticketId,
            comment_id: commentId
          })
          .select()
          .single();

        if (attachmentError) throw attachmentError;

        onFileUploaded({
          id: attachmentData.id,
          file_name: attachmentData.file_name,
          size_bytes: attachmentData.size_bytes,
          storage_path: attachmentData.storage_path
        });
      }

      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      toast({
        title: "Success",
        description: `${selectedFiles.length} file(s) uploaded successfully`,
      });
    } catch (error: any) {
      console.error('Error uploading files:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Paperclip className="h-4 w-4 mr-2" />
          Attach Files
        </Button>
        
        {selectedFiles.length > 0 && (
          <Button
            type="button"
            size="sm"
            onClick={uploadFiles}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} file(s)`}
          </Button>
        )}
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Selected files:</p>
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 border rounded">
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
