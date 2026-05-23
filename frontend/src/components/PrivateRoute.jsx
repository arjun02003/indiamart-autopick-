import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children, role }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return null; // or a spinner

  if (!isAuthenticated) {
    return <Navigate to="/auth" />;
  }

  if (role && user?.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}
