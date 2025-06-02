
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ProcessedChunk {
  title: string;
  content: string;
  category: string;
  tags: string[];
}

export const PDFUploader = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processedChunks, setProcessedChunks] = useState<ProcessedChunk[]>([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setUploadedFile(acceptedFiles[0]);
        setError(null);
        setSuccess(false);
      }
    }
  });

  const processPDF = async () => {
    if (!uploadedFile || !user) return;

    setProcessing(true);
    setError(null);

    try {
      // Create FormData to send the PDF file
      const formData = new FormData();
      formData.append('pdf', uploadedFile);
      formData.append('userId', user.id);

      // Call the PDF processing edge function
      const { data, error } = await supabase.functions.invoke('process-pdf-knowledge', {
        body: formData
      });

      if (error) throw error;

      setProcessedChunks(data.chunks || []);
      setSuccess(true);
    } catch (error) {
      console.error('Error processing PDF:', error);
      setError(error.message || 'Failed to process PDF');
    } finally {
      setProcessing(false);
    }
  };

  const addToKnowledgeBase = async () => {
    if (!user || processedChunks.length === 0) return;

    setUploading(true);
    try {
      for (const chunk of processedChunks) {
        // Insert the chunk into knowledge base
        const { data: newEntry, error } = await supabase
          .from('knowledge_base')
          .insert({
            title: chunk.title,
            content: chunk.content,
            category: chunk.category,
            tags: chunk.tags,
            created_by_user_id: user.id
          })
          .select()
          .single();

        if (error) {
          console.error('Error inserting chunk:', error);
          continue;
        }

        // Generate embedding for the new entry
        if (newEntry) {
          await supabase.functions.invoke('generate-embeddings', {
            body: {
              text: `${chunk.title} ${chunk.content}`,
              table: 'knowledge_base',
              id: newEntry.id
            }
          });
        }
      }

      setSuccess(true);
      setUploadedFile(null);
      setProcessedChunks([]);
    } catch (error) {
      console.error('Error adding to knowledge base:', error);
      setError('Failed to add content to knowledge base');
    } finally {
      setUploading(false);
    }
  };

  if (success && processedChunks.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">PDF processed successfully!</p>
            <p className="text-sm text-gray-600 mt-2">
              Content has been added to your knowledge base.
            </p>
            <Button 
              onClick={() => {
                setSuccess(false);
                setUploadedFile(null);
                setError(null);
              }} 
              className="mt-4"
            >
              Upload Another PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          PDF Knowledge Base Upload
        </CardTitle>
        <CardDescription>
          Upload PDF documents to automatically extract and add content to your knowledge base
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!uploadedFile && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            {isDragActive ? (
              <p>Drop the PDF file here...</p>
            ) : (
              <div>
                <p className="text-lg font-medium">Drag & drop a PDF file here</p>
                <p className="text-sm text-gray-600 mt-1">or click to select a file</p>
              </div>
            )}
          </div>
        )}

        {uploadedFile && !processing && processedChunks.length === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <FileText className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">{uploadedFile.name}</span>
              <span className="text-xs text-gray-500">
                ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <Button onClick={processPDF} className="w-full">
              <FileText className="h-4 w-4 mr-2" />
              Process PDF
            </Button>
          </div>
        )}

        {processing && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Processing PDF and extracting content...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
        )}

        {processedChunks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Extracted Content ({processedChunks.length} sections)</h3>
              <Button onClick={addToKnowledgeBase} disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Adding to KB...
                  </>
                ) : (
                  'Add to Knowledge Base'
                )}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {processedChunks.map((chunk, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-sm">{chunk.title}</h4>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {chunk.content.substring(0, 150)}...
                  </p>
                  <div className="flex gap-1 mt-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {chunk.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
