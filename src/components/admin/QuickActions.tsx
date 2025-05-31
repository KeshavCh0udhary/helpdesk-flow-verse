
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Settings, BarChart } from 'lucide-react';
import { Link } from 'react-router-dom';

export const QuickActions = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common administrative tasks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link to="/admin/add-agent" className="block">
          <Button variant="outline" className="w-full justify-start">
            <Users className="h-4 w-4 mr-2" />
            Add Support Agent
          </Button>
        </Link>
        <Link to="/admin/department-management" className="block">
          <Button variant="outline" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Manage Departments
          </Button>
        </Link>
        <Link to="/admin/queue-management" className="block">
          <Button variant="outline" className="w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Manage Agent Queues
          </Button>
        </Link>
        <Link to="/admin/ticket-management" className="block">
          <Button variant="outline" className="w-full justify-start">
            <BarChart className="h-4 w-4 mr-2" />
            Ticket Management
          </Button>
        </Link>
        <Link to="/admin/user-management" className="block">
          <Button variant="outline" className="w-full justify-start">
            <Users className="h-4 w-4 mr-2" />
            User Management
          </Button>
        </Link>
        <Link to="/admin/reports" className="block">
          <Button variant="outline" className="w-full justify-start">
            <BarChart className="h-4 w-4 mr-2" />
            Reports & Analytics
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};
