import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Bell,
  User,
  LogOut,
  Shield,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Building,
  Users,
  Check,
  Trash2,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  CreditCard,
  FileText,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import api from "../../services/api";
import { toast } from "react-hot-toast";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const notificationRef = useRef(null);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowNotifications(false);
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Fetch notifications when panel opens
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!showNotifications || !user) return;

      setLoading(true);
      try {
        const { data } = await api.get("/users/notifications?limit=10");
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.stats?.unread || 0);
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [showNotifications, user]);

  // Fetch unread count on mount
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!user) return;
      try {
        const { data } = await api.get("/users/notifications?limit=1");
        setUnreadCount(data.data.stats?.unread || 0);
      } catch (err) {
        console.error("Failed to fetch unread count:", err);
      }
    };

    fetchUnreadCount();
  }, [user]);

  const markAsRead = async (notificationId) => {
    try {
      console.log("Marking as read:", notificationId);
      const response = await api.put(
        `/users/notifications/${notificationId}/read`,
      );
      console.log("Mark as read response:", response);
      setNotifications((prev) =>
        prev.map((n) =>
          (n.id || n._id) === notificationId ? { ...n, isRead: true } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      toast.success("Marked as read");
    } catch (err) {
      console.error("Mark as read error:", err.response?.data || err.message);
      toast.error(err.response?.data?.message || "Failed to mark as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put("/users/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error("Failed to mark all as read");
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      console.log("Deleting notification:", notificationId);
      const response = await api.delete(
        `/users/notifications/${notificationId}`,
      );
      console.log("Delete response:", response);
      setNotifications((prev) =>
        prev.filter((n) => (n.id || n._id) !== notificationId),
      );
      setUnreadCount((prev) => {
        const deletedNotif = notifications.find(
          (n) => (n.id || n._id) === notificationId,
        );
        return deletedNotif && !deletedNotif.isRead
          ? Math.max(0, prev - 1)
          : prev;
      });
      toast.success("Notification deleted");
    } catch (err) {
      console.error(
        "Delete notification error:",
        err.response?.data || err.message,
      );
      toast.error(
        err.response?.data?.message || "Failed to delete notification",
      );
    }
  };

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const navigation = {
    user: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "My Complaints", href: "/complaints", icon: MessageSquare },
      { name: "New Complaint", href: "/complaints/new", icon: Shield },
      { name: "Payments", href: "/payments/my-payments", icon: CreditCard },
    ],
    staff: [
      { name: "Workspace", href: "/staff/dashboard", icon: LayoutDashboard },
      {
        name: "Assigned Tasks",
        href: "/staff/complaints",
        icon: MessageSquare,
      },
      { name: "Templates", href: "/admin/templates", icon: FileText },
    ],
    org_admin: [
      {
        name: "Admin Overview",
        href: "/admin/dashboard",
        icon: LayoutDashboard,
      },
      { name: "Manage Staff", href: "/admin/staff", icon: User },
      { name: "Categories", href: "/admin/categories", icon: Settings },
      { name: "Payments", href: "/payments/my-payments", icon: CreditCard },
      { name: "Templates", href: "/admin/templates", icon: FileText },
      { name: "Audit Logs", href: "/admin/audit-log", icon: FileText },
    ],
    super_admin: [
      {
        name: "Platform Overview",
        href: "/admin/dashboard",
        icon: LayoutDashboard,
      },
      {
        name: "All Organizations",
        href: "/admin/organizations",
        icon: Building,
      }, // We'll need to create this or just let them see stats
      { name: "Manage Staff", href: "/admin/staff", icon: User },
      { name: "System Users", href: "/admin/users", icon: Users },
      { name: "Payments", href: "/payments/my-payments", icon: CreditCard },
      { name: "Templates", href: "/admin/templates", icon: FileText },
      { name: "Audit Logs", href: "/admin/audit-log", icon: FileText },
    ],
  };

  // Safe check for user role
  const userLinks = user && user.role ? navigation[user.role] : [];

  const activeClassName =
    "flex items-center px-3 py-2 text-sm font-medium text-primary border-b-2 border-primary";
  const inactiveClassName =
    "flex items-center px-3 py-2 text-sm font-medium text-gray-500 hover:text-primary hover:border-b-2 hover:border-gray-300 transition-all";

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Desktop Nav */}
          <div className="flex">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <Shield className="h-8 w-8 text-primary" />
              <div className="ml-2 hidden md:block">
                <div className="text-xl font-bold text-gray-900 leading-none">
                  CRS Portal
                </div>
                {user?.organization?.name && (
                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest leading-none mt-1">
                    {user.organization.name}
                  </div>
                )}
              </div>
            </Link>

            {user && (
              <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                {userLinks.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      isActive ? activeClassName : inactiveClassName
                    }
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Right side icons */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            {user ? (
              <>
                <button
                  onClick={toggleTheme}
                  className="p-2 text-gray-400 hover:text-primary transition-colors"
                  title={
                    isDarkMode ? "Switch to light mode" : "Switch to dark mode"
                  }
                  aria-label={
                    isDarkMode ? "Switch to light mode" : "Switch to dark mode"
                  }
                >
                  {isDarkMode ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </button>

                <div
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                    isOnline
                      ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                      : "text-amber-600 border-amber-200 bg-amber-50"
                  }`}
                  title={
                    isOnline ? "Connected to network" : "Network unavailable"
                  }
                >
                  {isOnline ? (
                    <Wifi className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 mr-1" />
                  )}
                  {isOnline ? "Online" : "Offline"}
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 text-gray-400 hover:text-primary relative"
                    aria-label="Open notifications"
                    aria-expanded={showNotifications}
                    aria-haspopup="dialog"
                  >
                    <Bell className="h-6 w-6" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 flex items-center justify-center h-5 w-5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {showNotifications && (
                    <div
                      ref={notificationRef}
                      className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[500px] overflow-hidden flex flex-col"
                    >
                      <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                        <h3 className="font-bold text-gray-900">
                          Notifications
                        </h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs font-bold text-primary hover:underline"
                            aria-label="Mark all notifications as read"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="overflow-y-auto flex-1">
                        {loading ? (
                          <div className="p-8 text-center text-gray-500">
                            Loading...
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">
                              No notifications
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {notifications.map((notification) => {
                              const notificationKey =
                                notification.id || notification._id;

                              return (
                                <div
                                  key={notificationKey}
                                  className={`p-4 hover:bg-gray-50 transition-colors ${
                                    !notification.isRead ? "bg-blue-50/50" : ""
                                  }`}
                                >
                                  <div className="flex justify-between items-start space-x-3">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-900">
                                        {notification.title}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {notification.message}
                                      </p>
                                      <p className="text-xs text-gray-400 mt-1">
                                        {formatTimeAgo(notification.createdAt)}
                                      </p>
                                    </div>
                                    <div className="flex space-x-1">
                                      {!notification.isRead && (
                                        <button
                                          onClick={() =>
                                            markAsRead(notificationKey)
                                          }
                                          className="p-1 text-gray-400 hover:text-green-500"
                                          title="Mark as read"
                                          aria-label="Mark notification as read"
                                        >
                                          <Check className="w-4 h-4" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() =>
                                          deleteNotification(notificationKey)
                                        }
                                        className="p-1 text-gray-400 hover:text-red-500"
                                        title="Delete"
                                        aria-label="Delete notification"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative ml-3 flex items-center space-x-3 border-l pl-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700 leading-none">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {user.role}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Logout"
                    aria-label="Logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex space-x-4">
                <Link
                  to="/login"
                  className="text-gray-500 hover:text-primary px-3 py-2 text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isOpen && (
        <div className="sm:hidden bg-white border-t">
          <div className="pt-2 pb-3 space-y-1">
            {userLinks.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="flex items-center px-4 py-2 text-base font-medium text-gray-600 hover:text-primary hover:bg-gray-50"
                onClick={() => setIsOpen(false)}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            ))}
          </div>
          {user && (
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="flex items-center px-4">
                <div className="flex-shrink-0">
                  <User className="h-10 w-10 p-2 rounded-full bg-gray-100 text-gray-600" />
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">
                    {user.name}
                  </div>
                  <div className="text-sm font-medium text-gray-500">
                    {user.email}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-base font-medium text-red-600 hover:bg-gray-50"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
