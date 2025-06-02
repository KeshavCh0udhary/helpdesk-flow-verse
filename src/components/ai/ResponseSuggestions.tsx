
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lightbulb, Copy, Check, AlertCircle, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ResponseSuggestion {
  title: string;
  content: string;
  tone: string;
  confidence: number;
}

interface ResponseSuggestionsProps {
  ticketId: string;
  onSelectResponse: (content: string) => void;
}

export const ResponseSuggestions = ({ ticketId, onSelectResponse }: ResponseSuggestionsProps) => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<ResponseSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [noSuggestions, setNoSuggestions] = useState(false);
  const [noSuggestionsMessage, setNoSuggestionsMessage] = useState('');

  useEffect(() => {
    if (ticketId && user) {
      fetchSuggestions();
    }
  }, [ticketId, user]);

  const fetchSuggestions = async () => {
    setLoading(true);
    setNoSuggestions(false);
    setNoSuggestionsMessage('');
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-response-suggestions', {
        body: {
          ticketId,
          agentId: user?.id
        }
      });

      if (error) throw error;

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        setNoSuggestions(false);
      } else {
        setSuggestions([]);
        setNoSuggestions(true);
        setNoSuggestionsMessage(data.message || 'No relevant information found to generate suggestions for this ticket.');
      }
    } catch (error) {
      console.error('Error fetching response suggestions:', error);
      setSuggestions([]);
      setNoSuggestions(true);
      setNoSuggestionsMessage('Unable to generate suggestions at this time.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const getToneColor = (tone: string) => {
    switch (tone.toLowerCase()) {
      case 'professional': return 'bg-blue-100 text-blue-800';
      case 'friendly': return 'bg-green-100 text-green-800';
      case 'detailed': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI Response Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Analyzing ticket and generating suggestions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          AI Response Suggestions
        </CardTitle>
        <CardDescription>
          AI-generated response suggestions based strictly on available knowledge base and templates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {noSuggestions ? (
          <div className="text-center py-8 space-y-4">
            <div className="flex items-center justify-center">
              <AlertCircle className="h-12 w-12 text-orange-400" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">No Suggestions Available</h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                {noSuggestionsMessage}
              </p>
            </div>
            <div className="flex items-center gap-2 justify-center text-xs text-gray-500">
              <Database className="h-4 w-4" />
              <span>Suggestions are generated only from verified knowledge base content</span>
            </div>
            <Button variant="outline" onClick={fetchSuggestions} className="mt-4">
              Retry Analysis
            </Button>
          </div>
        ) : (
          <>
            {suggestions.map((suggestion, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{suggestion.title}</h4>
                  <div className="flex gap-2">
                    <Badge className={getToneColor(suggestion.tone)}>
                      {suggestion.tone}
                    </Badge>
                    <Badge className={getConfidenceColor(suggestion.confidence)}>
                      {Math.round(suggestion.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
                
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                  {suggestion.content}
                </p>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(suggestion.content, index)}
                  >
                    {copiedIndex === index ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiedIndex === index ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onSelectResponse(suggestion.content)}
                  >
                    Use This Response
                  </Button>
                </div>
              </div>
            ))}
            
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Database className="h-4 w-4" />
                <span>All suggestions are based on verified knowledge base content</span>
              </div>
              <Button variant="outline" onClick={fetchSuggestions}>
                Regenerate Suggestions
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
