
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface FAQEntry {
  title: string;
  content: string;
  category: string;
  tags: string[];
}

export const FAQImporter = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(false);

  const faqEntries: FAQEntry[] = [
    {
      title: "What should I do if I see a login error page?",
      content: "Try clearing your browser cache/cookies, or try a different browser. If it persists, contact IT Support.",
      category: "FAQ",
      tags: ["login", "error", "browser", "troubleshooting"]
    },
    {
      title: "How to fix login error page",
      content: "If you encounter a login error page, follow these steps: 1) Clear your browser cache and cookies, 2) Try using a different web browser (Chrome, Firefox, Edge, or Safari), 3) If the problem continues, contact IT Support for assistance.",
      category: "Technical",
      tags: ["login", "error", "cache", "browser", "troubleshooting"]
    },
    {
      title: "Why do we use a ticketing system?",
      content: "The company uses a ticketing system for efficient request management, transparency, accountability, and improved service delivery. It helps track all requests, ensures nothing gets lost, and provides a clear audit trail.",
      category: "General",
      tags: ["ticketing", "system", "purpose", "benefits"]
    },
    {
      title: "What is the purpose of our ticketing system?",
      content: "Our ticketing system serves multiple purposes: 1) Efficient request management and tracking, 2) Transparency in service delivery, 3) Accountability for all team members, 4) Improved service quality through structured workflows, 5) Historical record keeping for analysis and improvement.",
      category: "General",
      tags: ["ticketing", "system", "purpose", "management", "workflow"]
    },
    {
      title: "Which web browsers are recommended for the system?",
      content: "Latest versions of Chrome, Firefox, Edge, and Safari are recommended for optimal performance.",
      category: "Technical",
      tags: ["browser", "compatibility", "requirements"]
    },
    {
      title: "How do I log in to the system?",
      content: "Use your standard company username and password via SSO (Single Sign-On). Follow the standard company login procedure.",
      category: "FAQ",
      tags: ["login", "sso", "authentication", "access"]
    },
    {
      title: "What is a ticket?",
      content: "A ticket is a digital record of your request, question, or issue, allowing for tracking and management throughout its lifecycle.",
      category: "General",
      tags: ["ticket", "definition", "request", "tracking"]
    },
    {
      title: "What does ticket status Open mean?",
      content: "Open status means your ticket is successfully submitted and awaiting assignment or review by the appropriate team.",
      category: "General",
      tags: ["status", "open", "ticket", "workflow"]
    },
    {
      title: "What does ticket status In Progress mean?",
      content: "In Progress status means an agent is actively working on your ticket and taking steps to resolve your issue.",
      category: "General",
      tags: ["status", "in progress", "ticket", "workflow"]
    },
    {
      title: "What does ticket status Resolved mean?",
      content: "Resolved status means the agent believes your issue is fixed or question answered. You may be asked to confirm the resolution.",
      category: "General",
      tags: ["status", "resolved", "ticket", "workflow"]
    }
  ];

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

  const importFAQs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      for (const faq of faqEntries) {
        // Check if entry already exists
        const { data: existing } = await supabase
          .from('knowledge_base')
          .select('id')
          .eq('title', faq.title)
          .eq('is_active', true)
          .single();

        if (!existing) {
          // Insert new entry
          const { data: newEntry, error } = await supabase
            .from('knowledge_base')
            .insert({
              title: faq.title,
              content: faq.content,
              category: faq.category,
              tags: faq.tags,
              created_by_user_id: user.id
            })
            .select()
            .single();

          if (error) {
            console.error('Error inserting FAQ:', error);
            continue;
          }

          // Generate embedding
          if (newEntry) {
            await generateEmbedding(newEntry.id, `${faq.title} ${faq.content}`);
          }
        }
      }

      setImported(true);
    } catch (error) {
      console.error('Error importing FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (imported) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">FAQ entries imported successfully!</p>
            <p className="text-sm text-gray-600 mt-2">
              {faqEntries.length} FAQ entries have been added to your knowledge base.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import FAQ Entries
        </CardTitle>
        <CardDescription>
          Import {faqEntries.length} essential FAQ entries to improve AI responses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This will add commonly asked questions and answers to your knowledge base, 
            including questions about login errors, system purpose, and ticket statuses.
          </p>
          <Button onClick={importFAQs} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Importing FAQ entries...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {faqEntries.length} FAQ Entries
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
