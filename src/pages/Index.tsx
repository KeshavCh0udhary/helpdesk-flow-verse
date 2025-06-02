
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

const Index = () => {
  const { user, loading } = useAuth();

  // Show minimal loading while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Quick redirect based on auth state
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

export default Index;
