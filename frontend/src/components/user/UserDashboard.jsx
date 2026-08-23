import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  Bell,
} from "lucide-react";
import api from "../../services/api";
import Loader from "../common/Loader";

const UserDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data } = await api.get("/complaints/my-stats");
        setStats(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) return <Loader text="Preparing your dashboard..." />;

  const statCards = [
    {
      title: "Total Raised",
      value: stats?.total || 0,
      icon: MessageSquare,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "In Progress",
      value: stats?.byStatus?.["in-progress"] || 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Resolved",
      value: stats?.byStatus?.["resolved"] || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Escalated",
      value: stats?.byStatus?.["escalated"] || 0,
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Welcome Back!
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Here's an overview of your support tickets.
          </p>
        </div>
        <Link
          to="/complaints/new"
          className="inline-flex items-center px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-blue-600 transition-all shadow-md shadow-blue-200"
        >
          <Plus className="w-5 h-5 mr-2" /> New Complaint
        </Link>
      </div>

      {/* Stats Grid */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
        role="list"
        aria-label="Complaint overview stats"
      >
        {statCards.map((card, i) => (
          <div
            key={i}
            role="listitem"
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div
              className={`w-12 h-12 rounded-xl ${card.bg} ${card.color} flex items-center justify-center mb-4`}
            >
              <card.icon className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {card.title}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Recent Complaints
            </h2>
            <Link
              to="/complaints"
              className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              View all
            </Link>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden divide-y divide-gray-50 dark:divide-gray-700">
            {stats?.recent?.length > 0 ? (
              stats.recent.map((c) => (
                <Link
                  key={c._id}
                  to={`/complaints/${c._id}`}
                  className="block p-5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`p-2 rounded-lg ${c.priority === "high" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}
                      >
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {c.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          ID: {c.complaintId} •{" "}
                          {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          c.status === "resolved"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {c.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-10 text-center text-gray-400 dark:text-gray-500 text-sm italic">
                No recent complaints to show.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Notifications/Tips */}
        <div className="space-y-6">
          <div className="bg-gray-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <Bell className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="font-bold text-lg mb-2">
                Need a faster resolution?
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Adding screenshots and clear descriptions helps our team
                identify problems 40% faster.
              </p>
              <Link
                to="/support"
                className="inline-block text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Learn more &rarr;
              </Link>
            </div>
            {/* Background design element */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
