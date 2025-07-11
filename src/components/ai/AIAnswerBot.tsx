
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, ThumbsUp, ThumbsDown, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AIResponse {
  answer: string;
  confidence: number;
  sources: Array<{
    id: string;
    title: string;
    category: string;
    similarity: number;
  }>;
  sessionId: string;
  usedFallback?: boolean;
}

export const AIAnswerBot = () => {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<boolean | null>(null);

  const askQuestion = async () => {
    if (!question.trim() || !user) return;

    setLoading(true);
    try {
      const sessionId = `session_${Date.now()}_${user.id}`;
      
      const { data, error } = await supabase.functions.invoke('ai-answer-bot', {
        body: {
          question: question.trim(),
          sessionId,
          userId: user.id
        }
      });

      if (error) throw error;

      setResponse(data);
    } catch (error) {
      console.error('Error asking AI:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (helpful: boolean) => {
    if (!response || !user) return;

    try {
      await supabase
        .from('ai_interactions')
        .update({ was_helpful: helpful })
        .eq('session_id', response.sessionId)
        .eq('user_id', user.id);

      setFeedback(helpful);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const resetChat = () => {
    setResponse(null);
    setFeedback(null);
    setQuestion('');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          AI Answer Bot
        </CardTitle>
        <CardDescription>
          Ask a question and get answers based strictly on our knowledge base
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Type your question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && askQuestion()}
            disabled={loading}
          />
          <Button onClick={askQuestion} disabled={loading || !question.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
          </Button>
        </div>

        {response && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {response.usedFallback ? (
                <Badge className="bg-orange-100 text-orange-800 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Insufficient Information
                </Badge>
              ) : (
                <>
                  <Badge className={getConfidenceColor(response.confidence)} >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {Math.round(response.confidence * 100)}% confidence
                  </Badge>
                  <Badge variant="outline">
                    Based on {response.sources.length} source{response.sources.length !== 1 ? 's' : ''}
                  </Badge>
                </>
              )}
            </div>

            <div className={`p-4 rounded-lg ${response.usedFallback ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
              <p className="text-gray-900">{response.answer}</p>
              {response.usedFallback && (
                <p className="text-sm text-orange-700 mt-2">
                  This response indicates that the available information was insufficient to answer your question.
                </p>
              )}
            </div>

            {response.sources.length > 0 && !response.usedFallback && (
              <div>
                <h4 className="font-medium text-sm text-gray-700 mb-2">Information Sources:</h4>
                <div className="space-y-1">
                  {response.sources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between text-sm bg-white p-2 rounded border">
                      <span className="text-blue-600 font-medium">{source.title}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{source.category}</Badge>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(source.similarity * 100)}% match
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {feedback === null && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-sm text-gray-600">Was this helpful?</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => submitFeedback(true)}
                >
                  <ThumbsUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => submitFeedback(false)}
                >
                  <ThumbsDown className="h-4 w-4" />
                </Button>
              </div>
            )}

            {feedback !== null && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-gray-600">
                  Thank you for your feedback!
                </span>
                <Button variant="outline" size="sm" onClick={resetChat}>
                  Ask Another Question
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
