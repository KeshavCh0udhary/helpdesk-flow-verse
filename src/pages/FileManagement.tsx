
import { FileManager } from '@/components/FileManager';

export default function FileManagement() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">File Management</h1>
        <p className="text-gray-600 mt-2">
          Manage and organize all your uploaded files and attachments
        </p>
      </div>
      
      <FileManager />
    </div>
  );
}
