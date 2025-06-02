
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, Info, Eye, Zap } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

interface ProcessedChunk {
  title: string;
  content: string;
  category: string;
  tags: string[];
  confidence?: number;
}

interface ProcessingResult {
  success: boolean;
  chunks: ProcessedChunk[];
  message: string;
  extractedTextSample?: string;
  processingMethod?: string;
  error?: string;
  details?: string;
}

export const LangChainPDFUploader = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processedChunks, setProcessedChunks] = useState<ProcessedChunk[]>([]);
  const [extractedSample, setExtractedSample] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingMethod, setProcessingMethod] = useState<string>('');

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB limit
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        setError('File rejected. Please ensure it\'s a PDF under 10MB.');
        return;
      }
      
      if (acceptedFiles.length > 0) {
        setUploadedFile(acceptedFiles[0]);
        setError(null);
        setSuccess(false);
        setProcessedChunks([]);
        setExtractedSample('');
        setProcessingMethod('');
      }
    }
  });

  const processPDF = async () => {
    if (!uploadedFile || !user) return;

    setProcessing(true);
    setError(null);

    try {
      console.log('Starting LangChain PDF processing...', uploadedFile.name);
      
      const formData = new FormData();
      formData.append('pdf', uploadedFile);
      formData.append('userId', user.id);

      // Call the new LangChain PDF processing edge function
      const { data, error } = await supabase.functions.invoke('process-pdf-langchain', {
        body: formData
      });

      if (error) throw error;

      console.log('LangChain PDF processing result:', data);

      if (data.success && data.chunks && data.chunks.length > 0) {
        setProcessedChunks(data.chunks);
        setExtractedSample(data.extractedTextSample || '');
        setProcessingMethod(data.processingMethod || 'langchain');
        toast({
          title: "PDF Processed with LangChain",
          description: `Extracted ${data.chunks.length} Q&A pairs using advanced AI processing.`,
        });
      } else {
        setError(data.error || 'No questions and answers could be extracted from the PDF.');
        toast({
          title: "Processing Failed",
          description: data.error || 'Failed to extract Q&A content from PDF.',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error processing PDF with LangChain:', error);
      setError(error.message || 'Failed to process PDF');
      toast({
        title: "Processing Failed",
        description: "Failed to extract content from PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const addToKnowledgeBase = async () => {
    if (!user || processedChunks.length === 0) return;

    setUploading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const chunk of processedChunks) {
        try {
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
            errorCount++;
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

          successCount++;
        } catch (chunkError) {
          console.error('Error processing chunk:', chunkError);
          errorCount++;
        }
      }

      if (successCount > 0) {
        setSuccess(true);
        setUploadedFile(null);
        setProcessedChunks([]);
        setExtractedSample('');
        toast({
          title: "Added to Knowledge Base",
          description: `Successfully added ${successCount} Q&A pairs to the knowledge base.`,
        });
      }

      if (errorCount > 0) {
        toast({
          title: "Partial Success",
          description: `${successCount} entries added, ${errorCount} failed. Check console for details.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error adding to knowledge base:', error);
      setError('Failed to add content to knowledge base');
      toast({
        title: "Upload Failed",
        description: "Failed to add content to knowledge base. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSuccess(false);
    setUploadedFile(null);
    setError(null);
    setProcessedChunks([]);
    setExtractedSample('');
    setProcessingMethod('');
  };

  if (success && processedChunks.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">PDF processed successfully with LangChain!</p>
            <p className="text-sm text-gray-600 mt-2">
              Q&A content has been added to your knowledge base using advanced AI processing.
            </p>
            <Button onClick={resetForm} className="mt-4">
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
          <Zap className="h-5 w-5 text-blue-500" />
          LangChain PDF Q&A Extractor
        </CardTitle>
        <CardDescription>
          Advanced PDF processing using LangChain and AI to extract questions and answers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-700">
            Powered by LangChain and OpenAI for superior text extraction and Q&A recognition.
          </span>
        </div>

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
                <p className="text-xs text-gray-500 mt-2">PDF files up to 10MB</p>
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
            <div className="flex gap-2">
              <Button onClick={processPDF} className="flex-1">
                <Zap className="h-4 w-4 mr-2" />
                Process with LangChain
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Remove
              </Button>
            </div>
          </div>
        )}

        {processing && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="font-medium">Processing with LangChain...</p>
              <p className="text-sm text-gray-600">Using advanced AI to extract Q&A content</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <div className="flex-1">
              <span className="text-sm text-red-600 font-medium">{error}</span>
              {extractedSample && (
                <details className="mt-2">
                  <summary className="text-xs text-red-500 cursor-pointer">View extracted sample</summary>
                  <pre className="text-xs text-red-500 mt-1 whitespace-pre-wrap bg-red-100 p-2 rounded">
                    {extractedSample}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )}

        {processedChunks.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">
                  Extracted Q&A Content ({processedChunks.length} pairs found)
                </h3>
                {processingMethod && (
                  <Badge variant="secondary" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    {processingMethod}
                  </Badge>
                )}
              </div>
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

            {extractedSample && (
              <details className="p-3 bg-gray-50 rounded-lg">
                <summary className="text-sm font-medium cursor-pointer text-gray-700">
                  View extracted text sample
                </summary>
                <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">
                  {extractedSample}
                </pre>
              </details>
            )}

            <div className="max-h-96 overflow-y-auto space-y-3 border rounded-lg p-4">
              {processedChunks.map((chunk, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm text-blue-700">Q: {chunk.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {chunk.category}
                      </span>
                      {chunk.confidence && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(chunk.confidence * 100)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">A:</span> {chunk.content}
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {chunk.tags.slice(0, 4).map((tag, tagIndex) => (
                      <span key={tagIndex} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetForm} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
