
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TicketData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  resolved_at: string | null;
  department_id: string;
  assigned_to_agent_id: string | null;
}

interface PatternInsight {
  pattern_type: string;
  pattern_data: {
    title: string;
    description: string;
    recommendations: string[];
    metrics: {
      count: number;
      percentage: number;
      time_period: string;
    };
  };
  confidence_score: number;
  impact_level: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('AI Pattern Detector - Starting analysis');

    // Fetch ticket data for analysis
    const { data: tickets, error: ticketError } = await supabaseClient
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (ticketError) {
      throw new Error(`Error fetching tickets: ${ticketError.message}`);
    }

    const ticketsData = tickets as TicketData[];
    console.log(`Analyzing ${ticketsData.length} tickets`);

    // Generate comprehensive insights
    const insights = await generateInsights(ticketsData);

    // Store insights in the database
    for (const insight of insights) {
      const { error: insertError } = await supabaseClient
        .from('pattern_analysis')
        .insert({
          pattern_type: insight.pattern_type,
          pattern_data: insight.pattern_data,
          confidence_score: insight.confidence_score,
          impact_level: insight.impact_level,
          status: 'active'
        });

      if (insertError) {
        console.error('Error inserting pattern:', insertError);
      }
    }

    console.log(`Generated ${insights.length} pattern insights`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        insights_generated: insights.length,
        insights: insights 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-pattern-detector function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function generateInsights(tickets: TicketData[]): Promise<PatternInsight[]> {
  const insights: PatternInsight[] = [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Ticket Volume Analysis
  const recentTickets = tickets.filter(t => new Date(t.created_at) > weekAgo);
  const monthlyTickets = tickets.filter(t => new Date(t.created_at) > monthAgo);
  
  if (recentTickets.length > 15) {
    insights.push({
      pattern_type: 'high_volume_surge',
      pattern_data: {
        title: 'High Ticket Volume Detected',
        description: `${recentTickets.length} tickets created in the last 7 days, indicating increased support demand.`,
        recommendations: [
          'Monitor for system-wide issues causing increased tickets',
          'Consider temporary staff augmentation',
          'Review auto-response capabilities for common issues',
          'Analyze root causes to prevent future surges'
        ],
        metrics: {
          count: recentTickets.length,
          percentage: Math.round((recentTickets.length / Math.max(tickets.length, 1)) * 100),
          time_period: 'last 7 days'
        }
      },
      confidence_score: 0.90,
      impact_level: recentTickets.length > 30 ? 'high' : 'medium'
    });
  }

  // 2. Resolution Time Analysis
  const resolvedTickets = tickets.filter(t => t.resolved_at);
  const resolutionTimes = resolvedTickets.map(t => {
    const created = new Date(t.created_at);
    const resolved = new Date(t.resolved_at!);
    return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
  });

  if (resolutionTimes.length > 0) {
    const avgResolutionTime = resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length;
    const slowTickets = resolutionTimes.filter(time => time > 48).length;

    if (avgResolutionTime > 24 || slowTickets > resolutionTimes.length * 0.3) {
      insights.push({
        pattern_type: 'slow_resolution_pattern',
        pattern_data: {
          title: 'Slow Resolution Times Detected',
          description: `Average resolution time is ${Math.round(avgResolutionTime * 10) / 10} hours, with ${slowTickets} tickets taking over 48 hours.`,
          recommendations: [
            'Review and optimize ticket triage processes',
            'Provide additional training for complex issue handling',
            'Implement escalation procedures for stalled tickets',
            'Consider knowledge base improvements for common issues'
          ],
          metrics: {
            count: Math.round(avgResolutionTime),
            percentage: Math.round((slowTickets / resolutionTimes.length) * 100),
            time_period: 'last 30 days'
          }
        },
        confidence_score: 0.85,
        impact_level: avgResolutionTime > 48 ? 'high' : 'medium'
      });
    }
  }

  // 3. Priority Distribution Analysis
  const highPriorityTickets = tickets.filter(t => t.priority === 'high' || t.priority === 'urgent');
  const openHighPriority = highPriorityTickets.filter(t => t.status === 'open' || t.status === 'in_progress');

  if (openHighPriority.length > 5) {
    insights.push({
      pattern_type: 'high_priority_backlog',
      pattern_data: {
        title: 'High Priority Ticket Backlog',
        description: `${openHighPriority.length} high-priority tickets are currently open or in progress.`,
        recommendations: [
          'Prioritize high-priority ticket resolution',
          'Allocate senior staff to urgent issues',
          'Review priority assignment criteria',
          'Implement emergency escalation procedures'
        ],
        metrics: {
          count: openHighPriority.length,
          percentage: Math.round((openHighPriority.length / Math.max(tickets.length, 1)) * 100),
          time_period: 'current'
        }
      },
      confidence_score: 0.95,
      impact_level: openHighPriority.length > 10 ? 'critical' : 'high'
    });
  }

  // 4. Unassigned Tickets Analysis
  const unassignedTickets = tickets.filter(t => 
    !t.assigned_to_agent_id && (t.status === 'open' || t.status === 'in_progress')
  );

  if (unassignedTickets.length > 3) {
    insights.push({
      pattern_type: 'unassigned_tickets',
      pattern_data: {
        title: 'Multiple Unassigned Tickets',
        description: `${unassignedTickets.length} tickets are currently unassigned, potentially causing delays in response.`,
        recommendations: [
          'Implement automatic ticket assignment rules',
          'Review agent workload distribution',
          'Ensure adequate staffing levels',
          'Set up alerts for unassigned ticket accumulation'
        ],
        metrics: {
          count: unassignedTickets.length,
          percentage: Math.round((unassignedTickets.length / Math.max(tickets.length, 1)) * 100),
          time_period: 'current'
        }
      },
      confidence_score: 0.90,
      impact_level: unassignedTickets.length > 10 ? 'high' : 'medium'
    });
  }

  // 5. Department Load Analysis
  const departmentGroups = tickets.reduce((acc, ticket) => {
    const deptId = ticket.department_id || 'unassigned';
    if (!acc[deptId]) acc[deptId] = [];
    acc[deptId].push(ticket);
    return acc;
  }, {} as Record<string, TicketData[]>);

  const deptLoadAnalysis = Object.entries(departmentGroups).map(([deptId, deptTickets]) => {
    const openTickets = deptTickets.filter(t => t.status === 'open' || t.status === 'in_progress');
    return {
      department_id: deptId,
      total: deptTickets.length,
      open: openTickets.length,
      load_percentage: (openTickets.length / Math.max(deptTickets.length, 1)) * 100
    };
  });

  const overloadedDepts = deptLoadAnalysis.filter(dept => dept.open > 10 && dept.load_percentage > 70);

  if (overloadedDepts.length > 0) {
    insights.push({
      pattern_type: 'department_overload',
      pattern_data: {
        title: 'Department Workload Imbalance',
        description: `${overloadedDepts.length} departments showing high workload with over 70% open tickets.`,
        recommendations: [
          'Redistribute tickets across departments',
          'Cross-train agents in multiple departments',
          'Review department capacity and staffing',
          'Implement workload balancing algorithms'
        ],
        metrics: {
          count: overloadedDepts.length,
          percentage: Math.round((overloadedDepts.length / Math.max(Object.keys(departmentGroups).length, 1)) * 100),
          time_period: 'current'
        }
      },
      confidence_score: 0.80,
      impact_level: overloadedDepts.length > 2 ? 'high' : 'medium'
    });
  }

  // 6. Recent Activity Patterns
  const todayTickets = tickets.filter(t => {
    const ticketDate = new Date(t.created_at);
    const today = new Date();
    return ticketDate.toDateString() === today.toDateString();
  });

  if (todayTickets.length > 8) {
    insights.push({
      pattern_type: 'daily_spike',
      pattern_data: {
        title: 'High Daily Ticket Volume',
        description: `${todayTickets.length} tickets created today, indicating a busy support day.`,
        recommendations: [
          'Monitor for emerging system issues',
          'Ensure adequate agent coverage',
          'Prepare quick responses for common issues',
          'Check for any scheduled maintenance or releases'
        ],
        metrics: {
          count: todayTickets.length,
          percentage: Math.round((todayTickets.length / Math.max(recentTickets.length, 1)) * 100),
          time_period: 'today'
        }
      },
      confidence_score: 0.75,
      impact_level: todayTickets.length > 15 ? 'medium' : 'low'
    });
  }

  // 7. System Health Overview (Always include one positive insight)
  const totalResolved = resolvedTickets.length;
  const resolutionRate = Math.round((totalResolved / Math.max(tickets.length, 1)) * 100);

  if (resolutionRate > 70 || insights.length === 0) {
    insights.push({
      pattern_type: 'system_performance',
      pattern_data: {
        title: 'Good System Performance',
        description: `Your support system maintains a ${resolutionRate}% resolution rate with ${totalResolved} tickets successfully resolved.`,
        recommendations: [
          'Continue current best practices',
          'Document successful resolution strategies',
          'Share knowledge across the team',
          'Consider process improvements for even better efficiency'
        ],
        metrics: {
          count: totalResolved,
          percentage: resolutionRate,
          time_period: 'overall'
        }
      },
      confidence_score: 0.95,
      impact_level: 'low'
    });
  }

  console.log(`Generated ${insights.length} insights from ${tickets.length} tickets`);
  return insights;
}
