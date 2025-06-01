
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import CreateTicket from "@/pages/CreateTicket";
import TicketDetails from "@/pages/TicketDetails";
import Search from "@/pages/Search";
import Reports from "@/pages/Reports";
import AddAgent from "@/pages/AddAgent";
import DepartmentManagement from "@/pages/DepartmentManagement";
import QueueManagement from "@/pages/QueueManagement";
import UserManagement from "@/pages/UserManagement";
import FileManagement from "@/pages/FileManagement";
import TicketManagement from "@/pages/TicketManagement";
import Unauthorized from "@/pages/Unauthorized";
import NotFound from "@/pages/NotFound";
import { TicketList } from "@/pages/TicketList";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminDashboard } from "@/components/AdminDashboard";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <div className="min-h-screen bg-background">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/tickets" 
                  element={
                    <ProtectedRoute>
                      <TicketList />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/create-ticket" 
                  element={
                    <ProtectedRoute>
                      <CreateTicket />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/ticket/:id" 
                  element={
                    <ProtectedRoute>
                      <TicketDetails />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/search" 
                  element={
                    <ProtectedRoute>
                      <Search />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/reports" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'support_agent']}>
                      <Reports />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin" 
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/add-agent" 
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AddAgent />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/department-management" 
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <DepartmentManagement />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/queue-management" 
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <QueueManagement />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/user-management" 
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <UserManagement />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/file-management" 
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <FileManagement />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/ticket-management" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'support_agent']}>
                      <TicketManagement />
                    </ProtectedRoute>
                  } 
                />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
