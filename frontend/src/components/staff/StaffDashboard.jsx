import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  ChevronRight,
  User,
} from "lucide-react";
import api from "../../services/api";
import Loader from "../common/Loader";

const StaffDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data } = await api.get("/staff/dashboard");
        setData(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <Loader text="Loading workspace..." />;

  const stats = [
    {
      title: "My Active Tasks",
      value: data?.overview?.active || 0,
      icon: ClipboardList,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Overdue",
      value: data?.overview?.overdue || 0,
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Resolved (Month)",
      value: data?.overview?.resolvedThisMonth || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Feedback Score",
      value: `${data?.feedback?.averageRating || 0}/5`,
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Staff Workspace
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage your assigned complaints and SLAs.
          </p>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Capacity
          </p>
          <div className="flex items-center space-x-2 mt-1">
            <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{
                  width: `${data?.overview?.capacity?.percentage || 0}%`,
                }}
              ></div>
            </div>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
              {data?.overview?.active}/{data?.overview?.capacity?.max}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
        role="list"
        aria-label="Staff workload stats"
      >
        {stats.map((stat, i) => (
          <div
            key={i}
            role="listitem"
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div
              className={`w-10 h-10 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center mb-4`}
            >
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {stat.title}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Urgent Attention Needed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-red-500" /> Urgent
              Attention
            </h2>
            <Link
              to="/staff/complaints"
              className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              View all tasks
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden divide-y divide-gray-50 dark:divide-gray-700">
            {data?.urgentComplaints?.length > 0 ? (
              data.urgentComplaints.map((c) => (
                <Link
                  key={c._id}
                  to={`/staff/complaints/${c._id}`}
                  className="block p-5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-2 h-2 rounded-full ${c.priority === "critical" ? "bg-red-500 animate-pulse" : "bg-orange-400"}`}
                      ></div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {c.title}
                        </h4>
                        <div className="flex items-center mt-1 space-x-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-mono font-bold text-primary">
                            {c.complaintId}
                          </span>
                          <span>•</span>
                          <span className="flex items-center">
                            <User className="w-3 h-3 mr-1" /> {c.user?.name}
                          </span>
                          <span>•</span>
                          <span
                            className={`font-semibold ${c.isOverdue ? "text-red-500" : "text-amber-600"}`}
                          >
                            <Clock className="w-3 h-3 inline mr-1" />
                            {c.isOverdue
                              ? "Overdue"
                              : `Due in ${c.hoursRemaining}h`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
                No urgent tasks at the moment. Excellent!
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Task Distribution
          </h2>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="space-y-4">
              {data?.categoryDistribution?.map((cat, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {cat.name}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {cat.count} items
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: cat.color,
                        width: `${data?.overview?.active ? (cat.count / data.overview.active) * 100 : 0}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
              {(!data?.categoryDistribution ||
                data.categoryDistribution.length === 0) && (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">
                  No active categories
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
