
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LangChainPDFUploader } from '@/components/ai/LangChainPDFUploader';
import { EnhancedAIAnswerBot } from '@/components/ai/EnhancedAIAnswerBot';

export default function LangChainDemo() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">LangChain AI Demo</h1>
        <p className="text-gray-600 mt-2">
          Advanced PDF processing and AI Q&A powered by LangChain and OpenAI
        </p>
      </div>
      
      <Tabs defaultValue="pdf" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pdf">PDF Processing</TabsTrigger>
          <TabsTrigger value="chat">AI Chat</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pdf" className="mt-6">
          <LangChainPDFUploader />
        </TabsContent>
        
        <TabsContent value="chat" className="mt-6">
          <EnhancedAIAnswerBot />
        </TabsContent>
      </Tabs>
    </div>
  );
}
