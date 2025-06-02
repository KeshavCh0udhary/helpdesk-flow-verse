
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponseSuggestions } from '@/components/ai/ResponseSuggestions';
import { AIAnswerBot } from '@/components/ai/AIAnswerBot';

interface AIToolsPanelProps {
  ticketId: string;
  onResponseSelect: (content: string) => void;
  canModifyTicket: boolean;
}

export const AIToolsPanel = ({ ticketId, onResponseSelect, canModifyTicket }: AIToolsPanelProps) => {
  if (!canModifyTicket) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Tools</CardTitle>
        <CardDescription>AI-powered assistance for ticket resolution</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="suggestions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="suggestions">Response</TabsTrigger>
            <TabsTrigger value="bot">Ask AI</TabsTrigger>
          </TabsList>
          <TabsContent value="suggestions" className="mt-4">
            <ResponseSuggestions 
              ticketId={ticketId} 
              onSelectResponse={onResponseSelect} 
            />
          </TabsContent>
          <TabsContent value="bot" className="mt-4">
            <AIAnswerBot />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
