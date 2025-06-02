import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Edit, Trash2, Book, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FAQImporter } from './FAQImporter';
import { PDFUploader } from './PDFUploader';
import { KnowledgeBaseOptimizer } from './KnowledgeBaseOptimizer';

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  usage_count: number;
  effectiveness_score: number;
  created_at: string;
  is_active: boolean;
}

export const KnowledgeBaseManager = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    tags: ''
  });

  const categories = ['FAQ', 'Technical', 'Billing', 'General', 'Troubleshooting'];

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      if (error) throw error;

      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching knowledge base entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateEmbedding = async (entryId: string, text: string) => {
    try {
      await supabase.functions.invoke('generate-embeddings', {
        body: {
          text,
          table: 'knowledge_base',
          id: entryId
        }
      });
    } catch (error) {
      console.error('Error generating embedding:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const entryData = {
        title: formData.title,
        content: formData.content,
        category: formData.category,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        created_by_user_id: user.id
      };

      if (editingEntry) {
        const { error } = await supabase
          .from('knowledge_base')
          .update(entryData)
          .eq('id', editingEntry.id);

        if (error) throw error;

        // Regenerate embedding for updated content
        await generateEmbedding(editingEntry.id, `${formData.title} ${formData.content}`);
      } else {
        const { data, error } = await supabase
          .from('knowledge_base')
          .insert(entryData)
          .select()
          .single();

        if (error) throw error;

        // Generate embedding for new entry
        await generateEmbedding(data.id, `${formData.title} ${formData.content}`);
      }

      setIsDialogOpen(false);
      setEditingEntry(null);
      setFormData({ title: '', content: '', category: '', tags: '' });
      fetchEntries();
    } catch (error) {
      console.error('Error saving knowledge base entry:', error);
    }
  };

  const handleEdit = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setFormData({
      title: entry.title,
      content: entry.content,
      category: entry.category,
      tags: entry.tags.join(', ')
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_base')
        .update({ is_active: false })
        .eq('id', entryId);

      if (error) throw error;

      fetchEntries();
    } catch (error) {
      console.error('Error deleting knowledge base entry:', error);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading knowledge base...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Book className="h-5 w-5" />
                Knowledge Base Manager
              </CardTitle>
              <CardDescription>
                Manage your knowledge base entries for AI-powered support
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingEntry(null);
                  setFormData({ title: '', content: '', category: '', tags: '' });
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingEntry ? 'Edit Knowledge Base Entry' : 'Add New Knowledge Base Entry'}
                  </DialogTitle>
                  <DialogDescription>
                    Create comprehensive entries to improve AI response quality
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      rows={6}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={formData.tags}
                      onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingEntry ? 'Update' : 'Create'} Entry
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="manage" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="manage">Manage</TabsTrigger>
              <TabsTrigger value="import">Import FAQ</TabsTrigger>
              <TabsTrigger value="upload">Upload PDF</TabsTrigger>
              <TabsTrigger value="optimize">Optimize</TabsTrigger>
            </TabsList>
            
            <TabsContent value="manage" className="space-y-4">
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search knowledge base..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {filteredEntries.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Book className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No knowledge base entries found</p>
                  </div>
                ) : (
                  filteredEntries.map((entry) => (
                    <Card key={entry.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium">{entry.title}</h3>
                              <Badge variant="outline">{entry.category}</Badge>
                              <Badge variant="secondary">{entry.usage_count} uses</Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {entry.content}
                            </p>
                            {entry.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {entry.tags.map((tag, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(entry)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDelete(entry.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="import">
              <FAQImporter />
            </TabsContent>
            
            <TabsContent value="upload">
              <PDFUploader />
            </TabsContent>
            
            <TabsContent value="optimize">
              <KnowledgeBaseOptimizer />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
