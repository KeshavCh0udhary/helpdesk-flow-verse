
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUpload } from '@/components/FileUpload';
import { 
  Download, 
  Trash2, 
  Search, 
  Filter, 
  FileText, 
  Image, 
  File,
  Calendar,
  User,
  SortAsc,
  SortDesc,
  Eye
} from 'lucide-react';

interface FileItem {
  id: string;
  file_name: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
  storage_path: string;
  ticket_id?: string;
  comment_id?: string;
  uploaded_by_user: { full_name: string };
  ticket?: { title: string; id: string };
}

export const FileManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const { data: attachments, error } = await supabase
        .from('attachments')
        .select(`
          id,
          file_name,
          size_bytes,
          mime_type,
          created_at,
          storage_path,
          ticket_id,
          comment_id,
          uploaded_by_user_id
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles and ticket info
      const userIds = [...new Set(attachments.map(a => a.uploaded_by_user_id))];
      const ticketIds = [...new Set(attachments.filter(a => a.ticket_id).map(a => a.ticket_id))];

      const [{ data: profiles }, { data: tickets }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', userIds),
        supabase.from('tickets').select('id, title').in('id', ticketIds)
      ]);

      const profilesMap = profiles?.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}) || {};
      const ticketsMap = tickets?.reduce((acc, t) => ({ ...acc, [t.id]: t }), {}) || {};

      const enrichedFiles = attachments.map(file => ({
        ...file,
        uploaded_by_user: profilesMap[file.uploaded_by_user_id] || { full_name: 'Unknown User' },
        ticket: file.ticket_id ? ticketsMap[file.ticket_id] : undefined
      }));

      setFiles(enrichedFiles);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: "Failed to load files",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUploaded = (newFile: any) => {
    fetchFiles(); // Refresh the file list
    toast({
      title: "Success",
      description: "File uploaded successfully",
    });
  };

  const downloadFile = async (storagePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .download(storagePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const deleteFile = async (fileId: string, storagePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('attachments')
        .remove([storagePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('attachments')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      setFiles(files.filter(f => f.id !== fileId));
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const bulkDelete = async () => {
    if (selectedFiles.length === 0) return;

    try {
      const filesToDelete = files.filter(f => selectedFiles.includes(f.id));
      const storagePaths = filesToDelete.map(f => f.storage_path);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('attachments')
        .remove(storagePaths);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('attachments')
        .delete()
        .in('id', selectedFiles);

      if (dbError) throw dbError;

      setFiles(files.filter(f => !selectedFiles.includes(f.id)));
      setSelectedFiles([]);
      toast({
        title: "Success",
        description: `${selectedFiles.length} files deleted successfully`,
      });
    } catch (error) {
      console.error('Error deleting files:', error);
      toast({
        title: "Error",
        description: "Failed to delete files",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
    if (mimeType?.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const getFileTypeFilter = (mimeType: string) => {
    if (mimeType?.startsWith('image/')) return 'images';
    if (mimeType?.includes('pdf')) return 'documents';
    return 'other';
  };

  // Filter and sort files
  const filteredFiles = files
    .filter(file => {
      const matchesSearch = file.file_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = fileTypeFilter === 'all' || getFileTypeFilter(file.mime_type) === fileTypeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.file_name.localeCompare(b.file_name);
          break;
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'size':
          comparison = a.size_bytes - b.size_bytes;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const selectAllFiles = () => {
    setSelectedFiles(filteredFiles.map(f => f.id));
  };

  const clearSelection = () => {
    setSelectedFiles([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>File Manager</CardTitle>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="images">Images</SelectItem>
                  <SelectItem value="documents">Documents</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={(value: 'name' | 'date' | 'size') => setSortBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="list" className="w-full">
            <TabsList>
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="upload">Upload Files</TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="space-y-4">
              {selectedFiles.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-blue-700">
                    {selectedFiles.length} file(s) selected
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      Clear Selection
                    </Button>
                    <Button variant="destructive" size="sm" onClick={bulkDelete}>
                      Delete Selected
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  {filteredFiles.length} file(s) found
                </p>
                {filteredFiles.length > 0 && (
                  <Button variant="outline" size="sm" onClick={selectAllFiles}>
                    Select All
                  </Button>
                )}
              </div>
              
              <div className="space-y-2">
                {filteredFiles.map((file) => (
                  <div 
                    key={file.id} 
                    className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 ${
                      selectedFiles.includes(file.id) ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.id)}
                        onChange={() => toggleFileSelection(file.id)}
                        className="rounded"
                      />
                      <div className="flex items-center space-x-2">
                        {getFileIcon(file.mime_type)}
                        <div>
                          <p className="font-medium">{file.file_name}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {file.uploaded_by_user.full_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(file.created_at).toLocaleDateString()}
                            </span>
                            <span>{formatFileSize(file.size_bytes)}</span>
                            {file.ticket && (
                              <Badge variant="outline">
                                Ticket: {file.ticket.title.substring(0, 30)}...
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadFile(file.storage_path, file.file_name)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteFile(file.id, file.storage_path)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {filteredFiles.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No files found</p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="upload">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Upload New Files</h3>
                <FileUpload
                  onFileUploaded={handleFileUploaded}
                  maxFileSize={50}
                  allowedTypes={[
                    'image/*',
                    'application/pdf',
                    '.doc',
                    '.docx',
                    '.txt',
                    '.xlsx',
                    '.csv'
                  ]}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
