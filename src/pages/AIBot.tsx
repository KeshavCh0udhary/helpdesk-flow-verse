
import { AIAnswerBot } from '@/components/ai/AIAnswerBot';

export default function AIBot() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">AI Assistant</h1>
        <p className="text-gray-600 mt-2">
          Get instant answers to your questions from our knowledge base
        </p>
      </div>
      
      <AIAnswerBot />
    </div>
  );
}
