
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/NotificationBell';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { User, LogOut, Settings, Plus, Users, BarChart3, Menu } from 'lucide-react';

export const Navbar = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const NavigationLinks = () => (
    <>
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
          <span className="hidden sm:inline">New Ticket</span>
        </Link>
      )}
      
      {profile?.role === 'admin' && (
        <>
          <Link
            to="/admin/add-agent"
            className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Add Agent</span>
          </Link>
          <Link
            to="/admin/queue-management"
            className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Queue</span>
          </Link>
          <Link
            to="/admin/ticket-management"
            className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Tickets</span>
          </Link>
          <Link
            to="/admin/department-management"
            className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Departments</span>
          </Link>
        </>
      )}
    </>
  );

  const MobileNavigationLinks = () => (
    <div className="flex flex-col space-y-3 mt-4">
      <Link
        to="/"
        className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
      >
        Dashboard
      </Link>
      
      {profile?.role === 'employee' && (
        <Link
          to="/tickets/new"
          className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Ticket
        </Link>
      )}
      
      {profile?.role === 'admin' && (
        <>
          <Link
            to="/admin/add-agent"
            className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Add Agent
          </Link>
          <Link
            to="/admin/queue-management"
            className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Queue Management
          </Link>
          <Link
            to="/admin/ticket-management"
            className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Ticket Management
          </Link>
          <Link
            to="/admin/department-management"
            className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Department Management
          </Link>
        </>
      )}
    </div>
  );

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-gray-900 mr-4">
              Helpdesk
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex md:space-x-2">
              <NavigationLinks />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <NotificationBell />
            
            {/* Mobile Menu */}
            {isMobile && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72">
                  <SheetHeader>
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <MobileNavigationLinks />
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {profile?.full_name || 'User'}
                      </span>
                    </div>
                    <Button 
                      onClick={handleSignOut} 
                      variant="outline" 
                      className="w-full flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            )}
            
            {/* Desktop User Menu */}
            <div className="hidden md:block">
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
      </div>
    </nav>
  );
};
