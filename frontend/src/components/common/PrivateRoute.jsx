import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Loader from "./Loader";

/**
 * A wrapper for routes that require authentication.
 * If the user is not logged in, redirect to /login but save the current location.
 */
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader fullScreen text="Verifying session..." />;
  }

  if (!user) {
    // Redirect to login, but save the current location so we can redirect back
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (
    user.role === "user" &&
    user.isOnboarded === false &&
    location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  if (
    user.role === "user" &&
    user.isOnboarded === true &&
    location.pathname === "/onboarding"
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PrivateRoute;
