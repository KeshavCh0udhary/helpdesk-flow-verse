
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not found');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('AI Pattern Detector - Starting analysis');

    // Get recent tickets for pattern analysis
    const { data: tickets, error: ticketError } = await supabaseClient
      .from('tickets')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        department_id,
        created_at,
        resolved_at,
        assigned_to_agent_id
      `)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (ticketError) {
      throw new Error(`Error fetching tickets: ${ticketError.message}`);
    }

    // Get departments for context
    const { data: departments, error: deptError } = await supabaseClient
      .from('departments')
      .select('id, name');

    if (deptError) {
      throw new Error(`Error fetching departments: ${deptError.message}`);
    }

    // Prepare data for AI analysis
    const ticketSummary = tickets.map(ticket => ({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description.substring(0, 200),
      status: ticket.status,
      priority: ticket.priority,
      department: departments.find(d => d.id === ticket.department_id)?.name || 'Unknown',
      created_at: ticket.created_at,
      resolved_at: ticket.resolved_at,
      has_agent: !!ticket.assigned_to_agent_id
    }));

    const analysisPrompt = `Analyze these support tickets from the last 7 days and identify important patterns or issues.

Ticket Data:
${JSON.stringify(ticketSummary, null, 2)}

Look for:
1. Duplicate or similar issues that might indicate a systemic problem
2. Departments with unusual ticket volumes or resolution times
3. Escalation patterns (multiple high priority tickets)
4. Unassigned tickets or bottlenecks
5. Recurring themes in titles/descriptions

Respond with JSON in this format:
{
  "patterns": [
    {
      "type": "duplicate_tickets|escalation_trend|department_overload|user_behavior|other",
      "title": "Brief pattern title",
      "description": "Detailed description of the pattern",
      "confidence": 0.85,
      "impact_level": "low|medium|high|critical",
      "affected_tickets": ["ticket_id1", "ticket_id2"],
      "recommendations": ["recommendation1", "recommendation2"],
      "metrics": {
        "count": 5,
        "percentage": 12.5,
        "time_period": "7_days"
      }
    }
  ]
}`;

    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert data analyst specializing in customer support patterns. Always respond with valid JSON only.' 
          },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    const analysisData = await analysisResponse.json();
    const patterns = JSON.parse(analysisData.choices[0].message.content);

    // Store detected patterns in the database
    const storedPatterns = [];
    for (const pattern of patterns.patterns) {
      const { data: storedPattern, error: storeError } = await supabaseClient
        .from('pattern_analysis')
        .insert({
          pattern_type: pattern.type,
          pattern_data: {
            title: pattern.title,
            description: pattern.description,
            affected_tickets: pattern.affected_tickets,
            recommendations: pattern.recommendations,
            metrics: pattern.metrics
          },
          confidence_score: pattern.confidence,
          impact_level: pattern.impact_level,
          metadata: {
            analysis_date: new Date().toISOString(),
            ticket_count_analyzed: tickets.length,
            time_period: '7_days'
          }
        })
        .select()
        .single();

      if (storeError) {
        console.error('Error storing pattern:', storeError);
      } else {
        storedPatterns.push(storedPattern);
      }
    }

    // Store AI interaction
    await supabaseClient
      .from('ai_interactions')
      .insert({
        session_id: `pattern_analysis_${new Date().toISOString()}`,
        interaction_type: 'pattern_detection',
        input_text: `Analyzed ${tickets.length} tickets from last 7 days`,
        ai_response: JSON.stringify(patterns),
        confidence_score: patterns.patterns.length > 0 
          ? patterns.patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.patterns.length 
          : 0,
        metadata: {
          patterns_detected: patterns.patterns.length,
          tickets_analyzed: tickets.length,
          time_period: '7_days'
        }
      });

    console.log(`Detected ${patterns.patterns.length} patterns from ${tickets.length} tickets`);

    return new Response(
      JSON.stringify({
        success: true,
        patterns_detected: patterns.patterns.length,
        patterns: storedPatterns,
        summary: {
          tickets_analyzed: tickets.length,
          time_period: '7_days',
          analysis_date: new Date().toISOString()
        }
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
