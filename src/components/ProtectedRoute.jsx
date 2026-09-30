import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageLoader from './Loading/PageLoader';

/**
 * Wraps a route and enforces authentication + optional role checks.
 *
 * While the AuthContext is still verifying the stored token on first load
 * (initializing === true) we show the loading screen rather than redirecting —
 * checking isAuthenticated before the silent refresh completes would bounce a
 * signed-in user to /login. It used to render nothing, which on a slow
 * connection was several seconds of blank page.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const location = useLocation();
  const { user, isAuthenticated, initializing } = useAuth();

  // Still checking the stored token.
  if (initializing) {
    return <PageLoader fullScreen />;
  }

  // Not authenticated — redirect to login, preserving the intended destination
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // Authenticated but wrong role — show forbidden
  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to="/forbidden"
        state={{ from: location }}
        replace
      />
    );
  }

  return children;
};

export default ProtectedRoute;
