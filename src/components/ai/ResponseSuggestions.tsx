
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lightbulb, Copy, Check, AlertCircle, Database, RefreshCw, Sparkles } from 'lucide-react';
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
      case 'professional': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'friendly': return 'bg-green-50 text-green-700 border-green-200';
      case 'detailed': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (confidence >= 0.6) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-full shadow-sm">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Analyzing Ticket</h3>
              <p className="text-sm text-gray-600 mt-1">Generating intelligent response suggestions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {noSuggestions ? (
        <div className="text-center py-12 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-100">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-white rounded-full shadow-sm">
                <AlertCircle className="h-8 w-8 text-orange-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">No Suggestions Available</h3>
              <p className="text-sm text-gray-600 max-w-sm mx-auto leading-relaxed">
                {noSuggestionsMessage}
              </p>
            </div>
            <div className="flex items-center gap-2 justify-center text-xs text-gray-500 bg-white px-3 py-2 rounded-full inline-flex">
              <Database className="h-3 w-3" />
              <span>Based on verified knowledge base content</span>
            </div>
            <Button 
              variant="outline" 
              onClick={fetchSuggestions} 
              className="mt-4 bg-white hover:bg-gray-50"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Analysis
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">
                {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} generated
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchSuggestions}
              className="text-xs hover:bg-blue-50"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </div>

          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <Card key={index} className="border border-gray-200 hover:border-blue-200 transition-colors shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-medium text-gray-900 leading-snug">
                      {suggestion.title}
                    </CardTitle>
                    <div className="flex gap-1.5 ml-3">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getToneColor(suggestion.tone)}`}
                      >
                        {suggestion.tone}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}
                      >
                        {Math.round(suggestion.confidence * 100)}%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0 space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {suggestion.content}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(suggestion.content, index)}
                      className="flex-1 bg-white hover:bg-gray-50"
                    >
                      {copiedIndex === index ? (
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copiedIndex === index ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onSelectResponse(suggestion.content)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Use Response
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="flex items-center justify-center pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-full">
              <Database className="h-3 w-3" />
              <span>Powered by verified knowledge base</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
