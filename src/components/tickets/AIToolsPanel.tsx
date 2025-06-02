
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponseSuggestions } from '@/components/ai/ResponseSuggestions';
import { EnhancedAIAnswerBot } from '@/components/ai/EnhancedAIAnswerBot';

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
        <CardTitle>Enhanced AI Tools</CardTitle>
        <CardDescription>LangChain-powered AI assistance for ticket resolution</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="suggestions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="suggestions">Response</TabsTrigger>
            <TabsTrigger value="bot">AI Assistant</TabsTrigger>
          </TabsList>
          <TabsContent value="suggestions" className="mt-4">
            <ResponseSuggestions 
              ticketId={ticketId} 
              onSelectResponse={onResponseSelect} 
            />
          </TabsContent>
          <TabsContent value="bot" className="mt-4">
            <EnhancedAIAnswerBot />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
