
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navbar } from "@/components/Navbar";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import CreateTicket from "./pages/CreateTicket";
import TicketDetails from "./pages/TicketDetails";
import AddAgent from "./pages/AddAgent";
import QueueManagement from "./pages/QueueManagement";
import TicketManagement from "./pages/TicketManagement";
import UserManagement from "./pages/UserManagement";
import Reports from "./pages/Reports";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import DepartmentManagement from "./pages/DepartmentManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Protected routes */}
            <Route path="/" element={<Index />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Navbar />
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/tickets/new" element={
              <ProtectedRoute allowedRoles={['employee']}>
                <Navbar />
                <CreateTicket />
              </ProtectedRoute>
            } />

            <Route path="/tickets/:id" element={
              <ProtectedRoute>
                <Navbar />
                <TicketDetails />
              </ProtectedRoute>
            } />

            <Route path="/admin/add-agent" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Navbar />
                <AddAgent />
              </ProtectedRoute>
            } />

            <Route path="/admin/department-management" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Navbar />
                <DepartmentManagement />
              </ProtectedRoute>
            } />

            <Route path="/admin/queue-management" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Navbar />
                <QueueManagement />
              </ProtectedRoute>
            } />

            <Route path="/admin/ticket-management" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Navbar />
                <TicketManagement />
              </ProtectedRoute>
            } />

            <Route path="/admin/user-management" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Navbar />
                <UserManagement />
              </ProtectedRoute>
            } />

            <Route path="/admin/reports" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Navbar />
                <Reports />
              </ProtectedRoute>
            } />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
