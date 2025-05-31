
import { AlertCircle } from 'lucide-react';

export const EmptyTicketsState = () => {
  return (
    <div className="text-center py-8">
      <AlertCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">All tickets assigned!</h3>
      <p className="text-gray-600">No unassigned tickets at the moment</p>
    </div>
  );
};
