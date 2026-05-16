import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null; // or a spinner

  return isAuthenticated ? children : <Navigate to="/auth" />;
}
