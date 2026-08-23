import { useAuth } from "../hooks/useAuth";
import UserDashboard from "../components/user/UserDashboard";
import StaffDashboard from "../components/staff/StaffDashboard";
import AdminDashboard from "../components/admin/AdminDashboard";
import Loader from "../components/common/Loader";

const Dashboard = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader fullScreen text="Syncing your profile..." />;
  }

  // Role-based dashboard selection
  switch (user?.role) {
    case "super_admin": // Reusing AdminDashboard for now, but usually needs a specialized one
    case "admin":
    case "org_admin":
      return <AdminDashboard />;
    case "staff":
      return <StaffDashboard />;
    case "user":
    default:
      return <UserDashboard />;
  }
};

export default Dashboard;
