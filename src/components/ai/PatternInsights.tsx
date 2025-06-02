
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TrendingUp, AlertTriangle, CheckCircle, X, Clock, Users, FileText } from 'lucide-react';
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
  const [stats, setStats] = useState({
    totalTickets: 0,
    openTickets: 0,
    averageResolutionTime: 0,
    recentTickets: 0
  });

  useEffect(() => {
    fetchPatterns();
    fetchTicketStats();
  }, []);

  const fetchTicketStats = async () => {
    try {
      const { data: tickets } = await supabase
        .from('tickets')
        .select('status, created_at, resolved_at');

      if (tickets) {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const recentTickets = tickets.filter(t => new Date(t.created_at) > weekAgo);
        const resolvedTickets = tickets.filter(t => t.resolved_at);
        
        let avgResolution = 0;
        if (resolvedTickets.length > 0) {
          const totalTime = resolvedTickets.reduce((sum, ticket) => {
            if (ticket.resolved_at) {
              const created = new Date(ticket.created_at);
              const resolved = new Date(ticket.resolved_at);
              return sum + (resolved.getTime() - created.getTime());
            }
            return sum;
          }, 0);
          avgResolution = totalTime / resolvedTickets.length / (1000 * 60 * 60); // Convert to hours
        }

        setStats({
          totalTickets: tickets.length,
          openTickets: tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length,
          averageResolutionTime: Math.round(avgResolution * 10) / 10,
          recentTickets: recentTickets.length
        });
      }
    } catch (error) {
      console.error('Error fetching ticket stats:', error);
    }
  };

  const fetchPatterns = async () => {
    try {
      const { data, error } = await supabase
        .from('pattern_analysis')
        .select('*')
        .eq('status', 'active')
        .order('detected_at', { ascending: false })
        .limit(10);

      if (error) throw error;

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
      
      // If no patterns exist, generate some sample insights based on current data
      if (transformedPatterns.length === 0) {
        generateSampleInsights();
      }
    } catch (error) {
      console.error('Error fetching patterns:', error);
      generateSampleInsights();
    } finally {
      setLoading(false);
    }
  };

  const generateSampleInsights = () => {
    const samplePatterns: Pattern[] = [];
    
    // Generate insights based on current stats
    if (stats.openTickets > 5) {
      samplePatterns.push({
        id: 'sample-1',
        pattern_type: 'high_open_tickets',
        pattern_data: {
          title: 'High Volume of Open Tickets',
          description: `Currently ${stats.openTickets} tickets are open or in progress, indicating potential workload issues.`,
          recommendations: [
            'Consider reassigning tickets to distribute workload',
            'Review ticket priority and escalate urgent issues',
            'Evaluate if additional support staff is needed'
          ],
          metrics: {
            count: stats.openTickets,
            percentage: Math.round((stats.openTickets / Math.max(stats.totalTickets, 1)) * 100),
            time_period: 'current'
          }
        },
        confidence_score: 0.85,
        impact_level: 'medium',
        status: 'active',
        detected_at: new Date().toISOString()
      });
    }

    if (stats.averageResolutionTime > 24) {
      samplePatterns.push({
        id: 'sample-2',
        pattern_type: 'slow_resolution',
        pattern_data: {
          title: 'Slow Resolution Times',
          description: `Average resolution time is ${stats.averageResolutionTime} hours, which may indicate process inefficiencies.`,
          recommendations: [
            'Review ticket resolution workflows',
            'Provide additional training to support agents',
            'Consider automating common issue responses'
          ],
          metrics: {
            count: Math.round(stats.averageResolutionTime),
            percentage: 0,
            time_period: 'last 30 days'
          }
        },
        confidence_score: 0.75,
        impact_level: 'high',
        status: 'active',
        detected_at: new Date().toISOString()
      });
    }

    if (stats.recentTickets > 10) {
      samplePatterns.push({
        id: 'sample-3',
        pattern_type: 'ticket_surge',
        pattern_data: {
          title: 'Recent Ticket Volume Increase',
          description: `${stats.recentTickets} tickets created in the last 7 days, showing increased activity.`,
          recommendations: [
            'Monitor for emerging issues or system problems',
            'Prepare for potential capacity needs',
            'Review recent changes that might cause increased tickets'
          ],
          metrics: {
            count: stats.recentTickets,
            percentage: 0,
            time_period: 'last 7 days'
          }
        },
        confidence_score: 0.70,
        impact_level: 'medium',
        status: 'active',
        detected_at: new Date().toISOString()
      });
    }

    // Always show at least one insight about system performance
    if (samplePatterns.length === 0) {
      samplePatterns.push({
        id: 'sample-default',
        pattern_type: 'system_health',
        pattern_data: {
          title: 'System Operating Normally',
          description: `Your helpdesk system is running smoothly with ${stats.totalTickets} total tickets managed.`,
          recommendations: [
            'Continue monitoring ticket trends',
            'Maintain current support processes',
            'Consider proactive improvements to knowledge base'
          ],
          metrics: {
            count: stats.totalTickets,
            percentage: 100,
            time_period: 'overall'
          }
        },
        confidence_score: 0.90,
        impact_level: 'low',
        status: 'active',
        detected_at: new Date().toISOString()
      });
    }

    setPatterns(samplePatterns);
  };

  const runPatternAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-pattern-detector');

      if (error) {
        console.error('Pattern analysis error:', error);
        // Fallback to generating insights from current data
        await fetchTicketStats();
        generateSampleInsights();
      } else {
        await fetchPatterns(); // Refresh the patterns
      }
    } catch (error) {
      console.error('Error running pattern analysis:', error);
      // Fallback to generating insights from current data
      await fetchTicketStats();
      generateSampleInsights();
    } finally {
      setAnalyzing(false);
    }
  };

  const acknowledgePattern = async (patternId: string) => {
    if (patternId.startsWith('sample-')) {
      // Remove sample patterns locally
      setPatterns(patterns.filter(p => p.id !== patternId));
      return;
    }

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
      case 'escalation_trend': 
      case 'ticket_surge': 
      case 'high_open_tickets': return <TrendingUp className="h-5 w-5" />;
      case 'duplicate_tickets': return <AlertTriangle className="h-5 w-5" />;
      case 'slow_resolution': return <Clock className="h-5 w-5" />;
      case 'system_health': return <CheckCircle className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Pattern Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading insights...</span>
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
              AI Pattern Insights
            </CardTitle>
            <CardDescription>
              AI-powered analysis of your support ticket patterns and trends
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
              'Refresh Analysis'
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.totalTickets}</div>
            <div className="text-xs text-blue-700">Total Tickets</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{stats.openTickets}</div>
            <div className="text-xs text-orange-700">Open Tickets</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.averageResolutionTime}h</div>
            <div className="text-xs text-green-700">Avg Resolution</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{stats.recentTickets}</div>
            <div className="text-xs text-purple-700">This Week</div>
          </div>
        </div>

        {patterns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No patterns detected</p>
            <p className="text-sm">Click "Refresh Analysis" to analyze current data</p>
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
                          {pattern.pattern_data.metrics.percentage > 0 && (
                            <span> ({pattern.pattern_data.metrics.percentage.toFixed(1)}% of total)</span>
                          )}
                          <span> • {pattern.pattern_data.metrics.time_period}</span>
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
