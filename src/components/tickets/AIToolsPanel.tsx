
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponseSuggestions } from '@/components/ai/ResponseSuggestions';
import { AIAnswerBot } from '@/components/ai/AIAnswerBot';
import { Brain, MessageSquare } from 'lucide-react';

interface AIToolsPanelProps {
  ticketId: string;
  onResponseSelect: (content: string) => void;
  canModifyTicket: boolean;
}

export const AIToolsPanel = ({ ticketId, onResponseSelect, canModifyTicket }: AIToolsPanelProps) => {
  if (!canModifyTicket) return null;

  return (
    <Card className="border-blue-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Brain className="h-5 w-5 text-blue-600" />
          </div>
          AI Assistant
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          Intelligent tools to help resolve tickets faster
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="suggestions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-50">
            <TabsTrigger value="suggestions" className="flex items-center gap-2 data-[state=active]:bg-white">
              <MessageSquare className="h-4 w-4" />
              Smart Responses
            </TabsTrigger>
            <TabsTrigger value="bot" className="flex items-center gap-2 data-[state=active]:bg-white">
              <Brain className="h-4 w-4" />
              Ask AI
            </TabsTrigger>
          </TabsList>
          <TabsContent value="suggestions" className="mt-4 space-y-0">
            <ResponseSuggestions 
              ticketId={ticketId} 
              onSelectResponse={onResponseSelect} 
            />
          </TabsContent>
          <TabsContent value="bot" className="mt-4 space-y-0">
            <AIAnswerBot />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
