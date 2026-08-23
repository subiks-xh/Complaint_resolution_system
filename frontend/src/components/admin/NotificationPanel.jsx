import { useState, useEffect } from "react";
import {
  Bell,
  AlertTriangle,
  Clock,
  ShieldAlert,
  X,
  CheckCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import api from "../../services/api";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const NotificationPanel = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all");

  const fetchNotifications = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const { data } = await api.get("/admin/notifications", {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      setNotifications(data.data);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(() => {
      fetchNotifications({ silent: true });
    }, 30000);

    const handleFocus = () => {
      fetchNotifications({ silent: true });
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const markAsRead = async (notificationId) => {
    try {
      await api.patch(`/admin/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif._id === notificationId ? { ...notif, isRead: true } : notif,
        ),
      );
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch("/admin/notifications/mark-all-read");
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, isRead: true })),
      );
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "sla_breach":
      case "escalation_warning":
        return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case "complaint_escalated":
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case "new_assignment":
        return <Bell className="w-5 h-5 text-blue-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotificationBg = (type, isRead) => {
    const base = isRead ? "bg-gray-50" : "bg-white border-l-4";
    switch (type) {
      case "sla_breach":
        return `${base} border-l-red-500`;
      case "escalation_warning":
        return `${base} border-l-orange-500`;
      case "complaint_escalated":
        return `${base} border-l-yellow-500`;
      default:
        return `${base} border-l-blue-500`;
    }
  };

  const filterNotifications = () => {
    switch (selectedFilter) {
      case "urgent":
        return notifications.filter((n) =>
          ["sla_breach", "escalation_warning", "complaint_escalated"].includes(
            n.type,
          ),
        );
      case "unread":
        return notifications.filter((n) => !n.isRead);
      default:
        return notifications;
    }
  };

  const urgentCount = notifications.filter(
    (n) =>
      ["sla_breach", "escalation_warning", "complaint_escalated"].includes(
        n.type,
      ) && !n.isRead,
  ).length;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getComplaintIdForRoute = (notification) => {
    if (notification?.relatedComplaint) return notification.relatedComplaint;
    const actionUrl = notification?.actionUrl || "";
    const segments = actionUrl.split("/").filter(Boolean);
    return segments.length ? segments[segments.length - 1] : null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Notification Center</h1>
            <p className="text-blue-100">
              Stay informed about urgent cases and system alerts
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{urgentCount}</div>
              <div className="text-xs text-blue-100">Urgent</div>
            </div>
            <div className="w-px h-10 bg-blue-400"></div>
            <div className="text-center">
              <div className="text-2xl font-bold">{unreadCount}</div>
              <div className="text-xs text-blue-100">Unread</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSelectedFilter("all")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedFilter === "all"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setSelectedFilter("urgent")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedFilter === "urgent"
                ? "bg-red-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Urgent ({urgentCount})
          </button>
          <button
            onClick={() => setSelectedFilter("unread")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedFilter === "unread"
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchNotifications}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
            title="Refresh notifications"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filterNotifications().length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No notifications</p>
            <p className="text-sm">
              {selectedFilter === "urgent"
                ? "No urgent notifications at the moment"
                : selectedFilter === "unread"
                  ? "All notifications have been read"
                  : "You're all caught up!"}
            </p>
          </div>
        ) : (
          filterNotifications().map((notification) => (
            <div
              key={notification._id}
              className={`p-4 rounded-xl transition-all duration-200 hover:shadow-md ${getNotificationBg(
                notification.type,
                notification.isRead,
              )}`}
            >
              <div className="flex items-start space-x-3">
                {getNotificationIcon(notification.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          notification.isRead
                            ? "text-gray-600"
                            : "text-gray-900"
                        }`}
                      >
                        {notification.message}
                      </p>
                      {notification.metadata?.complaintId && (
                        <p className="text-xs text-gray-500 mt-1">
                          Ticket: {notification.metadata.complaintId}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {getComplaintIdForRoute(notification) && (
                        <Link
                          to={`/complaints/${getComplaintIdForRoute(notification)}`}
                          className="p-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
                          title="View complaint"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      )}

                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead(notification._id)}
                          className="p-1 rounded-lg bg-green-100 hover:bg-green-200 text-green-600 transition-colors"
                          title="Mark as read"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
