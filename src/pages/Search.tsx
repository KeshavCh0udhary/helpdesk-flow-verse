
import { GlobalSearch } from '@/components/search/GlobalSearch';

export default function Search() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Search</h1>
        <p className="text-gray-600 mt-2">
          Find tickets, comments, and files across the entire system
        </p>
      </div>
      
      <GlobalSearch />
    </div>
  );
}
