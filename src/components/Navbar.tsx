
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/NotificationBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Settings, Plus, Users, BarChart3 } from 'lucide-react';

export const Navbar = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-gray-900">
              Helpdesk
            </Link>
            
            <div className="hidden md:ml-6 md:flex md:space-x-8">
              <Link
                to="/"
                className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
              
              {profile?.role === 'employee' && (
                <Link
                  to="/tickets/new"
                  className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  New Ticket
                </Link>
              )}
              
              {profile?.role === 'admin' && (
                <>
                  <Link
                    to="/admin/add-agent"
                    className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1"
                  >
                    <Users className="h-4 w-4" />
                    Add Agent
                  </Link>
                  <Link
                    to="/admin/queue-management"
                    className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Queue
                  </Link>
                  <Link
                    to="/admin/ticket-management"
                    className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1"
                  >
                    <Settings className="h-4 w-4" />
                    Tickets
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <NotificationBell />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {profile?.full_name || 'User'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};
