import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, X, CheckCircle, AlertCircle, File, Image } from 'lucide-react';

interface UploadFile extends File {
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface AdvancedFileUploadProps {
  onFilesUploaded: (files: Array<{ id: string; file_name: string; size_bytes: number; storage_path: string }>) => void;
  ticketId?: string;
  commentId?: string;
  maxFileSize?: number; // in MB
  maxFiles?: number;
  allowedTypes?: string[];
}

export const AdvancedFileUpload = ({ 
  onFilesUploaded, 
  ticketId, 
  commentId, 
  maxFileSize = 10,
  maxFiles = 5,
  allowedTypes = ['image/*', 'application/pdf', '.doc', '.docx', '.txt']
}: AdvancedFileUploadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      ...file,
      id: Math.random().toString(36).substr(2, 9),
      progress: 0,
      status: 'pending'
    }));

    // Check file count limit
    if (uploadFiles.length + newFiles.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} files allowed`,
        variant: "destructive",
      });
      return;
    }

    // Validate file sizes
    const validFiles = newFiles.filter(file => {
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

    setUploadFiles(prev => [...prev, ...validFiles]);
  }, [maxFileSize, maxFiles, uploadFiles.length, toast]);

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    accept: allowedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: () => setIsDragActive(false)
  });

  const updateFileStatus = (id: string, updates: Partial<UploadFile>) => {
    setUploadFiles(prev => prev.map(file => 
      file.id === id ? { ...file, ...updates } : file
    ));
  };

  const removeFile = (id: string) => {
    setUploadFiles(prev => prev.filter(file => file.id !== id));
  };

  const uploadSingleFile = async (file: UploadFile) => {
    if (!user) return;

    updateFileStatus(file.id, { status: 'uploading', progress: 0 });

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      
      // Upload to Supabase Storage with progress tracking
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      updateFileStatus(file.id, { progress: 50 });

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

      updateFileStatus(file.id, { 
        status: 'completed', 
        progress: 100 
      });

      return {
        id: attachmentData.id,
        file_name: attachmentData.file_name,
        size_bytes: attachmentData.size_bytes,
        storage_path: attachmentData.storage_path
      };
    } catch (error: any) {
      console.error('Error uploading file:', error);
      updateFileStatus(file.id, { 
        status: 'error', 
        error: error.message || 'Upload failed',
        progress: 0 
      });
      throw error;
    }
  };

  const uploadAllFiles = async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    const uploadedFiles: Array<{ id: string; file_name: string; size_bytes: number; storage_path: string }> = [];

    for (const file of pendingFiles) {
      try {
        const result = await uploadSingleFile(file);
        if (result) {
          uploadedFiles.push(result);
        }
      } catch (error) {
        // Error already handled in uploadSingleFile
      }
    }

    if (uploadedFiles.length > 0) {
      onFilesUploaded(uploadedFiles);
      toast({
        title: "Success",
        description: `${uploadedFiles.length} file(s) uploaded successfully`,
      });
    }

    // Keep only failed files for potential retry
    setUploadFiles(prev => prev.filter(f => f.status === 'error'));
  };

  const retryFailedUploads = async () => {
    const failedFiles = uploadFiles.filter(f => f.status === 'error');
    for (const file of failedFiles) {
      updateFileStatus(file.id, { status: 'pending', error: undefined });
    }
    await uploadAllFiles();
  };

  const clearAllFiles = () => {
    setUploadFiles([]);
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (file: UploadFile) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4 text-blue-500" />;
    }
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive || dropzoneActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              or click to browse files
            </p>
            <div className="text-xs text-gray-400">
              <p>Max {maxFiles} files • Max {maxFileSize}MB per file</p>
              <p>Supported: {allowedTypes.join(', ')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {uploadFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Files to Upload ({uploadFiles.length})</h4>
              <div className="flex gap-2">
                {uploadFiles.some(f => f.status === 'error') && (
                  <Button variant="outline" size="sm" onClick={retryFailedUploads}>
                    Retry Failed
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={clearAllFiles}>
                  Clear All
                </Button>
                <Button 
                  size="sm" 
                  onClick={uploadAllFiles}
                  disabled={!uploadFiles.some(f => f.status === 'pending')}
                >
                  Upload All
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {uploadFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3 flex-1">
                    {getFileIcon(file)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant={
                              file.status === 'completed' ? 'default' :
                              file.status === 'error' ? 'destructive' :
                              file.status === 'uploading' ? 'secondary' : 'outline'
                            }
                          >
                            {file.status}
                          </Badge>
                          {getStatusIcon(file.status)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        {file.status === 'uploading' && (
                          <span className="text-xs text-gray-500">{file.progress}%</span>
                        )}
                      </div>
                      {file.status === 'uploading' && (
                        <Progress value={file.progress} className="h-1 mt-2" />
                      )}
                      {file.error && (
                        <p className="text-xs text-red-500 mt-1">{file.error}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    disabled={file.status === 'uploading'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
