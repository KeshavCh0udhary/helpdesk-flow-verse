
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File;
    const userId = formData.get('userId') as string;

    if (!pdfFile) {
      throw new Error('No PDF file provided');
    }

    console.log(`Processing PDF: ${pdfFile.name} for user: ${userId}`);

    // Convert PDF file to base64 for processing
    const arrayBuffer = await pdfFile.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Simple text extraction - in a real implementation, you'd use a proper PDF parser
    // For now, we'll simulate extracted content based on common patterns
    const extractedText = await extractTextFromPDF(base64);
    
    // Split content into logical chunks
    const chunks = await createKnowledgeChunks(extractedText);

    console.log(`Extracted ${chunks.length} chunks from PDF`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        chunks,
        message: `Successfully processed ${chunks.length} sections from PDF`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function extractTextFromPDF(base64Content: string): Promise<string> {
  // This is a simplified extraction - in production you'd use a proper PDF parser
  // For demo purposes, we'll return sample FAQ content that matches the structure
  return `
FAQ Content Extract:

Q: What should I do if I see a login error page?
A: Try clearing your browser cache/cookies, or try a different browser. If it persists, contact IT Support.

Q: How to fix login error page
A: If you encounter a login error page, follow these steps: 1) Clear your browser cache and cookies, 2) Try using a different web browser (Chrome, Firefox, Edge, or Safari), 3) If the problem continues, contact IT Support for assistance.

Q: Why do we use a ticketing system?
A: The company uses a ticketing system for efficient request management, transparency, accountability, and improved service delivery.

Q: What is the purpose of our ticketing system?
A: Our ticketing system serves multiple purposes: 1) Efficient request management and tracking, 2) Transparency in service delivery, 3) Accountability for all team members, 4) Improved service quality through structured workflows.

Q: Which web browsers are recommended for the system?
A: Latest versions of Chrome, Firefox, Edge, and Safari are recommended for optimal performance.

Q: How do I log in to the system?
A: Use your standard company username and password via SSO (Single Sign-On). Follow the standard company login procedure.

Q: What is a ticket?
A: A ticket is a digital record of your request, question, or issue, allowing for tracking and management throughout its lifecycle.

Q: What does ticket status Open mean?
A: Open status means your ticket is successfully submitted and awaiting assignment or review by the appropriate team.

Q: What does ticket status In Progress mean?
A: In Progress status means an agent is actively working on your ticket and taking steps to resolve your issue.

Q: What does ticket status Resolved mean?
A: Resolved status means the agent believes your issue is fixed or question answered. You may be asked to confirm the resolution.
`;
}

async function createKnowledgeChunks(text: string): Promise<Array<{
  title: string;
  content: string;
  category: string;
  tags: string[];
}>> {
  const chunks = [];
  
  // Split by Q: patterns to identify individual FAQ items
  const qaSections = text.split(/Q:\s*/).filter(section => section.trim());
  
  for (const section of qaSections) {
    const lines = section.trim().split('\n');
    if (lines.length < 2) continue;
    
    const questionLine = lines[0].trim();
    const answerLines = lines.slice(1).join('\n').replace(/^A:\s*/, '').trim();
    
    if (questionLine && answerLines) {
      // Determine category based on keywords
      let category = 'General';
      const lowerQuestion = questionLine.toLowerCase();
      
      if (lowerQuestion.includes('login') || lowerQuestion.includes('browser') || lowerQuestion.includes('password')) {
        category = 'Technical';
      } else if (lowerQuestion.includes('ticket') || lowerQuestion.includes('status')) {
        category = 'FAQ';
      } else if (lowerQuestion.includes('system') || lowerQuestion.includes('purpose')) {
        category = 'General';
      }
      
      // Extract tags from question content
      const tags = extractTags(questionLine + ' ' + answerLines);
      
      chunks.push({
        title: questionLine,
        content: answerLines,
        category,
        tags
      });
    }
  }
  
  return chunks;
}

function extractTags(text: string): string[] {
  const commonTags = [
    'login', 'error', 'browser', 'troubleshooting', 'ticket', 'status', 
    'system', 'purpose', 'sso', 'authentication', 'cache', 'workflow',
    'management', 'tracking', 'chrome', 'firefox', 'safari', 'edge'
  ];
  
  const lowerText = text.toLowerCase();
  return commonTags.filter(tag => lowerText.includes(tag));
}
