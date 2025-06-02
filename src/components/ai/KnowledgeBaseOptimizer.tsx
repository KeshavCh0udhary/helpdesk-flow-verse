
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const KnowledgeBaseOptimizer = () => {
  const { user } = useAuth();
  const [optimizing, setOptimizing] = useState(false);
  const [results, setResults] = useState<{
    processed: number;
    optimized: number;
    errors: number;
  } | null>(null);

  const optimizeKnowledgeBase = async () => {
    if (!user) return;

    setOptimizing(true);
    setResults(null);

    try {
      // Fetch all knowledge base entries
      const { data: entries, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      let processed = 0;
      let optimized = 0;
      let errors = 0;

      for (const entry of entries || []) {
        processed++;
        
        try {
          // Check if entry needs optimization (too long, poor structure, etc.)
          const needsOptimization = entry.content.length > 1000 || 
                                   entry.title.length < 10 ||
                                   !entry.tags || entry.tags.length === 0;

          if (needsOptimization) {
            // Optimize the content
            const optimizedContent = await optimizeContent(entry);
            
            // Update the entry
            const { error: updateError } = await supabase
              .from('knowledge_base')
              .update({
                title: optimizedContent.title,
                content: optimizedContent.content,
                tags: optimizedContent.tags,
                category: optimizedContent.category
              })
              .eq('id', entry.id);

            if (updateError) {
              console.error('Error updating entry:', updateError);
              errors++;
              continue;
            }

            // Regenerate embedding
            await supabase.functions.invoke('generate-embeddings', {
              body: {
                text: `${optimizedContent.title} ${optimizedContent.content}`,
                table: 'knowledge_base',
                id: entry.id
              }
            });

            optimized++;
          }
        } catch (error) {
          console.error('Error processing entry:', error);
          errors++;
        }
      }

      setResults({ processed, optimized, errors });
    } catch (error) {
      console.error('Error optimizing knowledge base:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const optimizeContent = async (entry: any) => {
    // Simple content optimization logic
    let title = entry.title;
    let content = entry.content;
    let tags = entry.tags || [];
    let category = entry.category;

    // Improve title if it's too short or generic
    if (title.length < 10) {
      title = content.split('.')[0].substring(0, 100) + '?';
    }

    // Truncate very long content and focus on the main answer
    if (content.length > 1000) {
      content = content.substring(0, 800) + '...';
    }

    // Extract better tags from content
    const contentLower = (title + ' ' + content).toLowerCase();
    const possibleTags = [
      'login', 'error', 'browser', 'troubleshooting', 'ticket', 'status',
      'system', 'authentication', 'password', 'help', 'support', 'access',
      'workflow', 'process', 'guide', 'instructions', 'technical', 'issue'
    ];

    tags = possibleTags.filter(tag => contentLower.includes(tag));

    // Improve category classification
    if (contentLower.includes('login') || contentLower.includes('browser') || contentLower.includes('technical')) {
      category = 'Technical';
    } else if (contentLower.includes('ticket') || contentLower.includes('request')) {
      category = 'FAQ';
    } else if (contentLower.includes('system') || contentLower.includes('process')) {
      category = 'General';
    }

    return { title, content, tags, category };
  };

  if (results) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">Knowledge Base Optimized!</p>
            <div className="text-sm text-gray-600 mt-2 space-y-1">
              <p>Processed: {results.processed} entries</p>
              <p>Optimized: {results.optimized} entries</p>
              {results.errors > 0 && (
                <p className="text-red-600">Errors: {results.errors} entries</p>
              )}
            </div>
            <Button 
              onClick={() => setResults(null)} 
              className="mt-4"
            >
              Done
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
          <Zap className="h-5 w-5" />
          Optimize Knowledge Base
        </CardTitle>
        <CardDescription>
          Automatically improve existing knowledge base entries for better AI matching
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>This will:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Improve titles and content structure</li>
              <li>Add relevant tags for better categorization</li>
              <li>Break down overly long entries</li>
              <li>Regenerate embeddings for better AI matching</li>
            </ul>
          </div>
          <Button onClick={optimizeKnowledgeBase} disabled={optimizing} className="w-full">
            {optimizing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Optimizing Knowledge Base...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Optimize Knowledge Base
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
