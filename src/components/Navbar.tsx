
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { 
  User, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Home,
  Ticket,
  Search,
  BarChart3,
  Users,
  Building2,
  FileText,
  Bot,
  Brain,
  Cog
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';

export const Navbar = () => {
  const { user, signOut, profile } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const navigationItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home, roles: ['admin', 'support_agent', 'employee'] },
    { path: '/tickets', label: 'Tickets', icon: Ticket, roles: ['admin', 'support_agent', 'employee'] },
    { path: '/ai-bot', label: 'AI Assistant', icon: Bot, roles: ['admin', 'support_agent', 'employee'] },
    { path: '/knowledge-base', label: 'Knowledge Base', icon: Brain, roles: ['admin', 'support_agent'] },
    { path: '/search', label: 'Search', icon: Search, roles: ['admin', 'support_agent', 'employee'] },
    { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'support_agent'] },
  ];

  const adminItems = [
    { 
      label: 'User Management',
      items: [
        { path: '/admin/user-management', label: 'Manage Users', icon: Users },
        { path: '/admin/add-agent', label: 'Add Agent', icon: Users },
      ]
    },
    { 
      label: 'System Management',
      items: [
        { path: '/admin/department-management', label: 'Departments', icon: Building2 },
        { path: '/admin/queue-management', label: 'Queues', icon: FileText },
        { path: '/admin/ticket-management', label: 'Ticket Management', icon: Ticket },
        { path: '/admin/file-management', label: 'File Management', icon: FileText },
      ]
    }
  ];

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'support_agent': return 'default';
      case 'employee': return 'secondary';
      default: return 'outline';
    }
  };

  if (!user) {
    return (
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-blue-600">
                HelpDesk Pro
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link to="/signup">
                <Button>Sign Up</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const filteredNavigationItems = navigationItems.filter(item => 
    item.roles.includes(profile?.role as string)
  );

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="text-xl font-bold text-blue-600">
              HelpDesk Pro
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              {filteredNavigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors ${
                      isActive(item.path)
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <NotificationBell />
            
            {/* Admin Dropdown - Organized */}
            {profile?.role === 'admin' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Cog className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {adminItems.map((group, groupIndex) => (
                    <div key={group.label}>
                      <div className="px-2 py-1.5 text-sm font-semibold text-gray-900">
                        {group.label}
                      </div>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <DropdownMenuItem key={item.path} asChild>
                            <Link to={item.path} className="flex items-center">
                              <Icon className="h-4 w-4 mr-2" />
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                      {groupIndex < adminItems.length - 1 && <DropdownMenuSeparator />}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Enhanced User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <span className="hidden sm:block">{profile?.full_name || 'User'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-3 py-2 border-b">
                  <p className="font-medium">{profile?.full_name || 'Unknown User'}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  <div className="mt-2">
                    <Badge variant={getRoleBadgeVariant(profile?.role || 'employee')}>
                      {profile?.role?.replace('_', ' ').toUpperCase() || 'EMPLOYEE'}
                    </Badge>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="pt-2 pb-3 space-y-1">
              {filteredNavigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`block pl-3 pr-4 py-2 text-base font-medium border-l-4 transition-colors ${
                      isActive(item.path)
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <Icon className="h-4 w-4 mr-3" />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
              
              {profile?.role === 'admin' && (
                <>
                  <div className="border-t border-gray-200 pt-4 pb-3">
                    <div className="px-4 text-sm font-medium text-gray-500 uppercase tracking-wider">
                      Admin
                    </div>
                  </div>
                  {adminItems.flatMap(group => group.items).map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className="block pl-3 pr-4 py-2 text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <div className="flex items-center">
                          <Icon className="h-4 w-4 mr-3" />
                          {item.label}
                        </div>
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
