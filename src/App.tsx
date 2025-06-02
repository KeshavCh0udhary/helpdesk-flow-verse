
import { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from '@/hooks/useAuth';

// Lazy load components
const Index = lazy(() => import('./pages/Index'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateTicket = lazy(() => import('./pages/CreateTicket'));
const TicketDetails = lazy(() => import('./pages/TicketDetails'));
const TicketList = lazy(() => import('./pages/TicketList'));
const AddAgent = lazy(() => import('./pages/AddAgent'));
const DepartmentManagement = lazy(() => import('./pages/DepartmentManagement'));
const QueueManagement = lazy(() => import('./pages/QueueManagement'));
const TicketManagement = lazy(() => import('./pages/TicketManagement'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const FileManagement = lazy(() => import('./pages/FileManagement'));
const Reports = lazy(() => import('./pages/Reports'));
const Search = lazy(() => import('./pages/Search'));
const AIBot = lazy(() => import('./pages/AIBot'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <div className="min-h-screen bg-gray-50">
              <Navbar />
              <main className="flex-1">
                <Suspense fallback={
                  <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
                  </div>
                }>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/unauthorized" element={<Unauthorized />} />
                    
                    {/* Protected Routes */}
                    <Route path="/dashboard" element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/tickets" element={
                      <ProtectedRoute>
                        <TicketList />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/tickets/new" element={
                      <ProtectedRoute allowedRoles={['employee']}>
                        <CreateTicket />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/tickets/:id" element={
                      <ProtectedRoute>
                        <TicketDetails />
                      </ProtectedRoute>
                    } />

                    <Route path="/ai-bot" element={
                      <ProtectedRoute>
                        <AIBot />
                      </ProtectedRoute>
                    } />

                    <Route path="/knowledge-base" element={
                      <ProtectedRoute>
                        <KnowledgeBase />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/search" element={
                      <ProtectedRoute>
                        <Search />
                      </ProtectedRoute>
                    } />
                    
                    {/* Admin Routes */}
                    <Route path="/admin/add-agent" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AddAgent />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/admin/department-management" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <DepartmentManagement />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/admin/queue-management" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <QueueManagement />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/admin/ticket-management" element={
                      <ProtectedRoute allowedRoles={['admin', 'support_agent']}>
                        <TicketManagement />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/admin/user-management" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <UserManagement />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/admin/file-management" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <FileManagement />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/reports" element={
                      <ProtectedRoute allowedRoles={['admin', 'support_agent']}>
                        <Reports />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>
            </div>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
