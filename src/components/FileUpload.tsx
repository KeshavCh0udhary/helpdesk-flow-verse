
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Paperclip, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  ticketId?: string;
  commentId?: string;
  onUploadComplete?: (attachment: any) => void;
}

export const FileUpload = ({ ticketId, commentId, onUploadComplete }: FileUploadProps) => {
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `attachments/${fileName}`;

        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save attachment record to database
        const { data: attachmentData, error: attachmentError } = await supabase
          .from('attachments')
          .insert({
            file_name: file.name,
            storage_path: uploadData.path,
            size_bytes: file.size,
            mime_type: file.type,
            ticket_id: ticketId,
            comment_id: commentId,
            uploaded_by_user_id: (await supabase.auth.getUser()).data.user?.id,
          })
          .select()
          .single();

        if (attachmentError) throw attachmentError;

        return attachmentData;
      });

      const attachments = await Promise.all(uploadPromises);
      
      toast({
        title: "Success",
        description: `${attachments.length} file(s) uploaded successfully`,
      });

      setFiles(null);
      if (onUploadComplete) {
        attachments.forEach(onUploadComplete);
      }

      // Reset the file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    if (!files) return;
    
    const dt = new DataTransfer();
    for (let i = 0; i < files.length; i++) {
      if (i !== index) {
        dt.items.add(files[i]);
      }
    }
    setFiles(dt.files);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          id="file-upload"
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById('file-upload')?.click()}
          className="flex items-center gap-2"
        >
          <Paperclip className="h-4 w-4" />
          Select Files
        </Button>
        
        {files && files.length > 0 && (
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : `Upload ${files.length} file(s)`}
          </Button>
        )}
      </div>

      {files && files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Selected files:</p>
          {Array.from(files).map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
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
