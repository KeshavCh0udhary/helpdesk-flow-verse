
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Clock, User, FileText, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SearchResult {
  id: string;
  type: 'ticket' | 'comment' | 'file';
  title: string;
  content: string;
  created_at: string;
  metadata: any;
}

interface SearchFilters {
  type: string;
  status: string;
  priority: string;
  department: string;
  dateRange: string;
}

export const GlobalSearch = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    type: 'all',
    status: 'all',
    priority: 'all',
    department: 'all',
    dateRange: 'all'
  });
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [searchTerm, filters]);

  const fetchDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');
    setDepartments(data || []);
  };

  const performSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    try {
      const searchResults: SearchResult[] = [];

      // Search tickets
      if (filters.type === 'all' || filters.type === 'ticket') {
        let ticketQuery = supabase
          .from('tickets')
          .select(`
            id,
            title,
            description,
            status,
            priority,
            created_at,
            department:departments(name)
          `)
          .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);

        if (filters.status !== 'all') {
          const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
          if (validStatuses.includes(filters.status)) {
            ticketQuery = ticketQuery.eq('status', filters.status);
          }
        }
        if (filters.priority !== 'all') {
          const validPriorities = ['urgent', 'high', 'medium', 'low'];
          if (validPriorities.includes(filters.priority)) {
            ticketQuery = ticketQuery.eq('priority', filters.priority);
          }
        }
        if (filters.department !== 'all') {
          ticketQuery = ticketQuery.eq('department_id', filters.department);
        }

        const { data: tickets } = await ticketQuery;
        
        tickets?.forEach(ticket => {
          searchResults.push({
            id: ticket.id,
            type: 'ticket',
            title: ticket.title,
            content: ticket.description,
            created_at: ticket.created_at,
            metadata: {
              status: ticket.status,
              priority: ticket.priority,
              department: ticket.department?.name
            }
          });
        });
      }

      // Search comments
      if (filters.type === 'all' || filters.type === 'comment') {
        const { data: comments } = await supabase
          .from('comments')
          .select(`
            id,
            content,
            created_at,
            ticket:tickets(id, title)
          `)
          .ilike('content', `%${searchTerm}%`);

        comments?.forEach(comment => {
          searchResults.push({
            id: comment.id,
            type: 'comment',
            title: `Comment on: ${comment.ticket?.title}`,
            content: comment.content,
            created_at: comment.created_at,
            metadata: {
              ticket_id: comment.ticket?.id,
              ticket_title: comment.ticket?.title
            }
          });
        });
      }

      // Search files
      if (filters.type === 'all' || filters.type === 'file') {
        const { data: files } = await supabase
          .from('attachments')
          .select(`
            id,
            file_name,
            created_at,
            ticket:tickets(id, title)
          `)
          .ilike('file_name', `%${searchTerm}%`);

        files?.forEach(file => {
          searchResults.push({
            id: file.id,
            type: 'file',
            title: file.file_name,
            content: `File attachment`,
            created_at: file.created_at,
            metadata: {
              ticket_id: file.ticket?.id,
              ticket_title: file.ticket?.title
            }
          });
        });
      }

      // Apply date range filter
      let filteredResults = searchResults;
      if (filters.dateRange !== 'all') {
        const now = new Date();
        let cutoffDate = new Date();
        
        switch (filters.dateRange) {
          case 'today':
            cutoffDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            cutoffDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            cutoffDate.setMonth(now.getMonth() - 1);
            break;
        }

        filteredResults = searchResults.filter(result => 
          new Date(result.created_at) >= cutoffDate
        );
      }

      // Sort by relevance and date
      filteredResults.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setResults(filteredResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'ticket':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'comment':
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'file':
        return <FileText className="h-4 w-4 text-purple-500" />;
      default:
        return <Search className="h-4 w-4 text-gray-500" />;
    }
  };

  const getResultLink = (result: SearchResult) => {
    switch (result.type) {
      case 'ticket':
        return `/tickets/${result.id}`;
      case 'comment':
        return `/tickets/${result.metadata.ticket_id}`;
      case 'file':
        return result.metadata.ticket_id ? `/tickets/${result.metadata.ticket_id}` : '#';
      default:
        return '#';
    }
  };

  const clearFilters = () => {
    setFilters({
      type: 'all',
      status: 'all',
      priority: 'all',
      department: 'all',
      dateRange: 'all'
    });
    setSearchTerm('');
    setResults([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Global Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tickets, comments, files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Select value={filters.type} onValueChange={(value) => setFilters({...filters, type: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Content Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ticket">Tickets</SelectItem>
                <SelectItem value="comment">Comments</SelectItem>
                <SelectItem value="file">Files</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={(value) => setFilters({...filters, priority: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.department} onValueChange={(value) => setFilters({...filters, department: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.dateRange} onValueChange={(value) => setFilters({...filters, dateRange: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
            {results.length > 0 && (
              <Badge variant="secondary">
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {loading && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Searching...</p>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result) => (
                <Link key={`${result.type}-${result.id}`} to={getResultLink(result)}>
                  <div className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        {getResultIcon(result.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium truncate">{result.title}</h4>
                            <Badge variant="outline" className="text-xs">
                              {result.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {result.content}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(result.created_at).toLocaleDateString()}
                            </span>
                            {result.metadata.status && (
                              <Badge variant="secondary" className="text-xs">
                                {result.metadata.status}
                              </Badge>
                            )}
                            {result.metadata.priority && (
                              <Badge 
                                variant={result.metadata.priority === 'urgent' ? 'destructive' : 'outline'}
                                className="text-xs"
                              >
                                {result.metadata.priority}
                              </Badge>
                            )}
                            {result.metadata.department && (
                              <span>{result.metadata.department}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {searchTerm.length >= 2 && results.length === 0 && !loading && (
        <Card>
          <CardContent className="p-6 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">
              Try adjusting your search terms or filters to find what you're looking for.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
