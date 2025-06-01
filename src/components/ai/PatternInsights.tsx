import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PatternData {
  title: string;
  description: string;
  recommendations: string[];
  metrics: {
    count: number;
    percentage: number;
    time_period: string;
  };
}

interface Pattern {
  id: string;
  pattern_type: string;
  pattern_data: PatternData;
  confidence_score: number;
  impact_level: string;
  status: string;
  detected_at: string;
}

export const PatternInsights = () => {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchPatterns();
  }, []);

  const fetchPatterns = async () => {
    try {
      const { data, error } = await supabase
        .from('pattern_analysis')
        .select('*')
        .eq('status', 'active')
        .order('detected_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Transform the data to match our interface with proper type checking
      const transformedPatterns = (data || []).map(item => ({
        id: item.id,
        pattern_type: item.pattern_type,
        pattern_data: item.pattern_data as unknown as PatternData,
        confidence_score: item.confidence_score,
        impact_level: item.impact_level,
        status: item.status,
        detected_at: item.detected_at
      }));

      setPatterns(transformedPatterns);
    } catch (error) {
      console.error('Error fetching patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const runPatternAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-pattern-detector');

      if (error) throw error;

      await fetchPatterns(); // Refresh the patterns
    } catch (error) {
      console.error('Error running pattern analysis:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const acknowledgePattern = async (patternId: string) => {
    try {
      const { error } = await supabase
        .from('pattern_analysis')
        .update({ status: 'acknowledged' })
        .eq('id', patternId);

      if (error) throw error;

      setPatterns(patterns.filter(p => p.id !== patternId));
    } catch (error) {
      console.error('Error acknowledging pattern:', error);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPatternIcon = (type: string) => {
    switch (type) {
      case 'escalation_trend': return <TrendingUp className="h-5 w-5" />;
      case 'duplicate_tickets': return <AlertTriangle className="h-5 w-5" />;
      default: return <TrendingUp className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pattern Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading patterns...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pattern Insights
            </CardTitle>
            <CardDescription>
              AI-detected patterns and trends in your support tickets
            </CardDescription>
          </div>
          <Button 
            onClick={runPatternAnalysis} 
            disabled={analyzing}
            variant="outline"
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Run Analysis'
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {patterns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No active patterns detected</p>
            <p className="text-sm">Run analysis to detect new patterns</p>
          </div>
        ) : (
          <div className="space-y-4">
            {patterns.map((pattern) => (
              <Alert key={pattern.id} className={getImpactColor(pattern.impact_level)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getPatternIcon(pattern.pattern_type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{pattern.pattern_data.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(pattern.confidence_score * 100)}% confidence
                        </Badge>
                        <Badge className={getImpactColor(pattern.impact_level)}>
                          {pattern.impact_level} impact
                        </Badge>
                      </div>
                      
                      <AlertDescription className="text-sm mb-3">
                        {pattern.pattern_data.description}
                      </AlertDescription>
                      
                      {pattern.pattern_data.metrics && (
                        <div className="text-xs text-gray-600 mb-3">
                          <span className="font-medium">{pattern.pattern_data.metrics.count} tickets</span>
                          {' '}({pattern.pattern_data.metrics.percentage.toFixed(1)}% of recent tickets)
                        </div>
                      )}
                      
                      {pattern.pattern_data.recommendations.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-700 mb-1">Recommendations:</h5>
                          <ul className="text-xs space-y-1">
                            {pattern.pattern_data.recommendations.map((rec, index) => (
                              <li key={index} className="flex items-start gap-1">
                                <CheckCircle className="h-3 w-3 mt-0.5 text-green-600 flex-shrink-0" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => acknowledgePattern(pattern.id)}
                    className="ml-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
