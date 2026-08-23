import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Layout & Common
import Navbar from "./components/common/Navbar";
import Footer from "./components/common/Footer";
import PrivateRoute from "./components/common/PrivateRoute";
import RoleBasedRoute from "./components/common/RoleBasedRoute";
import ErrorBoundary from "./components/common/ErrorBoundary";
import GlobalExperienceLayer from "./components/common/GlobalExperienceLayer";
import SupportChatbot from "./components/common/SupportChatbot";
import { useTheme } from "./context/ThemeContext";

// Auth Pages
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import ForgotPassword from "./components/auth/ForgotPassword";
import ResetPassword from "./components/auth/ResetPassword";
import GoogleOnboarding from "./components/auth/GoogleOnboarding";

// General Pages
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import About from "./pages/About";
import Features from "./pages/Features";
import Support from "./pages/Support";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import Unauthorized from "./pages/Unauthorized";

// User Specific
import ComplaintForm from "./components/user/ComplaintForm";
import ComplaintList from "./components/user/ComplaintList";
import ComplaintDetails from "./components/user/ComplaintDetails";

// Staff Specific
import AssignedComplaints from "./components/staff/AssignedComplaints";
import ComplaintWorkspace from "./components/staff/ComplaintWorkspace";

// Admin Specific
import StaffManagement from "./components/admin/StaffManagement";
import CategoryManagement from "./components/admin/CategoryManagement";
import AnalyticsPanel from "./components/admin/AnalyticsPanel";
import OrganizationManagement from "./components/admin/OrganizationManagement";
import ComplaintManagement from "./components/admin/ComplaintManagement";
import AssignmentRulesConfig from "./components/admin/AssignmentRulesConfig";
import SystemUsers from "./components/admin/SystemUsers";
import NotificationPanel from "./components/admin/NotificationPanel";
import EscalationRules from "./components/admin/EscalationRules";
import ReportingModule from "./components/admin/ReportingModule";
import PaymentCenter from "./components/admin/PaymentCenter";
import TemplateLibrary from "./components/admin/TemplateLibrary";
import AuditLogPanel from "./components/admin/AuditLogPanel";

function App() {
  const { isDarkMode } = useTheme();

  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 font-sans">
        <Navbar />

        <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          <GlobalExperienceLayer />

          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route
              path="/onboarding"
              element={
                <PrivateRoute>
                  <GoogleOnboarding />
                </PrivateRoute>
              }
            />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/about" element={<About />} />
            <Route path="/features" element={<Features />} />
            <Route path="/support" element={<Support />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />

            {/* Protected Routes (Any Authenticated User) */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  {" "}
                  <Dashboard />{" "}
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  {" "}
                  <Profile />{" "}
                </PrivateRoute>
              }
            />

            {/* User Routes */}
            <Route
              path="/complaints"
              element={
                <RoleBasedRoute allowedRoles={["user"]}>
                  {" "}
                  <ComplaintList />{" "}
                </RoleBasedRoute>
              }
            />
            <Route
              path="/complaints/new"
              element={
                <RoleBasedRoute allowedRoles={["user"]}>
                  {" "}
                  <ComplaintForm />{" "}
                </RoleBasedRoute>
              }
            />
            <Route
              path="/complaints/:id"
              element={
                <PrivateRoute>
                  {" "}
                  <ComplaintDetails />{" "}
                </PrivateRoute>
              }
            />

            {/* Staff Routes */}
            <Route
              path="/staff/dashboard"
              element={
                <RoleBasedRoute allowedRoles={["staff", "org_admin"]}>
                  {" "}
                  <Dashboard />{" "}
                </RoleBasedRoute>
              }
            />
            <Route
              path="/staff/complaints"
              element={
                <RoleBasedRoute allowedRoles={["staff", "org_admin"]}>
                  {" "}
                  <AssignedComplaints />{" "}
                </RoleBasedRoute>
              }
            />
            <Route
              path="/staff/complaints/:id"
              element={
                <RoleBasedRoute allowedRoles={["staff", "org_admin"]}>
                  {" "}
                  <ComplaintWorkspace />{" "}
                </RoleBasedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <RoleBasedRoute allowedRoles={["org_admin", "super_admin"]}>
                  {" "}
                  <Dashboard />{" "}
                </RoleBasedRoute>
              }
            />
            <Route
              path="/admin/staff"
              element={
                <RoleBasedRoute allowedRoles={["org_admin", "super_admin"]}>
                  {" "}
                  <StaffManagement />{" "}
                </RoleBasedRoute>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <RoleBasedRoute allowedRoles={["org_admin", "super_admin"]}>
                  {" "}
                  <CategoryManagement />{" "}
                </RoleBasedRoute>
              }
            />
            <Route
              path="/admin/complaints"
              element={
                <RoleBasedRoute allowedRoles={["org_admin", "super_admin"]}>
                  {" "}
                  <ComplaintManagement />{" "}
                </RoleBasedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <RoleBasedRoute allowedRoles={["org_admin", "super_admin"]}>
                  {" "}
                  <AnalyticsPanel />{" "}
                </RoleBasedRoute>
              }
            />
            <Route
              path="/admin/assignment-config"
              element={
                <RoleBasedRoute allowedRoles={["org_admin", "super_admin"]}>
                  {" "}
                  <AssignmentRulesConfig />{" "}
                </RoleBasedRoute>
              }
            />
            <Route
              path="/admin/organizations"
              element={
                <RoleBasedRoute allowedRoles={["super_admin"]}>
                  {" "}
                  <OrganizationManagement />{" "}
                </RoleBasedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <RoleBasedRoute allowedRoles={["super_admin"]}>
                  {" "}
                  <SystemUsers />{" "}
                </RoleBasedRoute>
              }
            />

            <Route
              path="/admin/notifications"
              element={
                <RoleBasedRoute allowedRoles={["org_admin", "super_admin"]}>
                  {" "}
                  <NotificationPanel />{" "}
                </RoleBasedRoute>
              }
            />

            <Route
              path="/payments/my-payments"
              element={
                <RoleBasedRoute
                  allowedRoles={["user", "admin", "org_admin", "super_admin"]}
                >
                  {" "}
                  <PaymentCenter />{" "}
                </RoleBasedRoute>
              }
            />

            <Route
              path="/admin/templates"
              element={
                <RoleBasedRoute
                  allowedRoles={["staff", "admin", "org_admin", "super_admin"]}
                >
                  {" "}
                  <TemplateLibrary />{" "}
                </RoleBasedRoute>
              }
            />

            <Route
              path="/admin/escalation-rules"
              element={
                <RoleBasedRoute allowedRoles={["org_admin", "super_admin"]}>
                  {" "}
                  <EscalationRules />{" "}
                </RoleBasedRoute>
              }
            />

            <Route
              path="/admin/audit-log"
              element={
                <RoleBasedRoute
                  allowedRoles={["org_admin", "super_admin", "admin"]}
                >
                  {" "}
                  <AuditLogPanel />{" "}
                </RoleBasedRoute>
              }
            />

            <Route
              path="/admin/reports"
              element={
                <RoleBasedRoute allowedRoles={["org_admin", "super_admin"]}>
                  {" "}
                  <ReportingModule />{" "}
                </RoleBasedRoute>
              }
            />

            {/* 404 Route */}
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </main>

        <Footer />

        {/* Global Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: isDarkMode ? "#1f2937" : "#ffffff",
              color: isDarkMode ? "#f3f4f6" : "#1f2937",
              borderRadius: "12px",
              border: isDarkMode ? "1px solid #374151" : "1px solid #f3f4f6",
              boxShadow: isDarkMode
                ? "0 10px 15px -3px rgba(0, 0, 0, 0.5)"
                : "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            },
            success: {
              style: {
                background: isDarkMode ? "#1f2937" : "#ffffff",
                color: isDarkMode ? "#f3f4f6" : "#1f2937",
              },
              iconTheme: {
                primary: "#10b981",
                secondary: isDarkMode ? "#1f2937" : "#ffffff",
              },
            },
            error: {
              style: {
                background: isDarkMode ? "#1f2937" : "#ffffff",
                color: isDarkMode ? "#f3f4f6" : "#1f2937",
              },
              iconTheme: {
                primary: "#ef4444",
                secondary: isDarkMode ? "#1f2937" : "#ffffff",
              },
            },
          }}
        />

        <SupportChatbot />
      </div>
    </ErrorBoundary>
  );
}

export default App;
