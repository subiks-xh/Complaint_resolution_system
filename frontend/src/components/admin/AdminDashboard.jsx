import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Users,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Settings,
  UserPlus,
  CreditCard,
  FileText,
  Activity,
} from "lucide-react";
import api from "../../services/api";
import Loader from "../common/Loader";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const response = await api.get("/admin/dashboard");
        console.log("Dashboard API Response:", response.data);
        setData(response.data.data);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        if (err?.response?.status !== 429) {
          toast.error("Failed to load dashboard data", {
            id: "admin-dashboard-load-error",
          });
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };
    fetchStats();
  }, [refreshKey]);

  // Remove auto-refresh to prevent rate limiting - only manual refresh
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     setRefreshKey((prev) => prev + 1);
  //   }, 10000);
  //   return () => clearInterval(interval);
  // }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
  };

  if (loading) return <Loader text="Generating analytics..." />;

  const COLORS = [
    "#3b82f6",
    "#f59e0b",
    "#10b981",
    "#ef4444",
    "#8b5cf6",
    "#6b7280",
  ];

  // Formatting data for Recharts with placeholder data
  const hasComplaints = data?.overview?.totalComplaints > 0;

  const statusData =
    data?.complaintsByStatus && Object.keys(data.complaintsByStatus).length > 0
      ? Object.entries(data.complaintsByStatus)
          .map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
          }))
          .filter((item) => item.value > 0) // Only include statuses with actual counts
      : [];

  const categoryData =
    data?.complaintsByCategory && data.complaintsByCategory.length > 0
      ? data.complaintsByCategory.filter((cat) => cat.count > 0)
      : [];

  // Custom label to show percentage
  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        className="font-semibold text-sm"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const kpis = [
    {
      title: "Total Tickets",
      value: data?.overview?.totalComplaints || 0,
      icon: MessageSquare,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Pending Assignment",
      value: data?.overview?.pendingComplaints || 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Overdue SLA",
      value: data?.overview?.overdueComplaints || 0,
      icon: ShieldAlert,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Resolution Rate",
      value: `${data?.overview?.resolutionRate || 0}%`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-sans">
            Admin Command Center
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Real-time oversight of system-wide complaint resolution.
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center space-x-4"
          >
            <div
              className={`w-12 h-12 rounded-xl ${kpi.bg} dark:bg-opacity-20 ${kpi.color} flex items-center justify-center flex-shrink-0`}
            >
              <kpi.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {kpi.title}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kpi.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
            Status Distribution
          </h3>
          <div className="h-64 relative">
            {!hasComplaints && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 rounded-lg z-10">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    No complaints yet
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Data will appear as complaints are created
                  </p>
                </div>
              </div>
            )}
            {hasComplaints && statusData.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Loading status data...
                </p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={statusData.length > 1 ? 5 : 0}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {statusData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) =>
                    `${value} complaint${value !== 1 ? "s" : ""}`
                  }
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry) =>
                    `${value} (${entry.payload.value})`
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Categories */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
            Top Issue Categories
          </h3>
          <div className="h-64 relative">
            {!hasComplaints && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 rounded-lg z-10">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    No category data yet
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Chart will populate with complaint data
                  </p>
                </div>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#f3f4f6"
                />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  axisLine={false}
                  tickLine={false}
                  style={{ fontSize: "12px", fill: "#6b7280" }}
                />
                <Tooltip cursor={{ fill: "transparent" }} />
                <Bar
                  dataKey="count"
                  fill="#3b82f6"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent High Priority */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Urgent Tickets
          </h3>
          <Link
            to="/admin/complaints"
            className="text-sm font-bold text-primary dark:text-blue-400 flex items-center hover:underline"
          >
            Manage All <ArrowRight className="ml-1 w-4 h-4" />
          </Link>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          {data?.recentComplaints && data.recentComplaints.length > 0 ? (
            data.recentComplaints.map((c) => (
              <div
                key={c._id}
                className="p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`p-2 rounded-lg ${c.priority === "high" ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" : "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"}`}
                  >
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                      {c.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      ID: {c.complaintId} • Assigned:{" "}
                      {c.assignedTo?.name || "Unassigned"}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase border ${
                    c.status === "escalated"
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800"
                      : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800"
                  }`}
                >
                  {c.status}
                </span>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                No urgent tickets
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                High priority complaints will appear here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Access Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Admin Tools
          </h3>
          <ShieldAlert className="w-5 h-5 text-gray-400 dark:text-gray-600" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/admin/notifications"
            className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                  Notifications
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Real-time alerts
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/escalation-rules"
            className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-500 rounded-lg">
                <ShieldAlert className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-orange-900 dark:text-orange-300">
                  Escalation Rules
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  SLA management
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/assignment-config"
            className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-500 rounded-lg">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">
                  Assignment Config
                </p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  Auto-assignment rules
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/payments/my-payments"
            className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500 rounded-lg">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
                  Payments
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Receipts & refunds
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/templates"
            className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-900 dark:text-purple-300">
                  Templates
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Reusable responses
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/reports"
            className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-900 dark:text-purple-300">
                  Reports
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Analytics & insights
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/complaints"
            className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <UserPlus className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-300">
                  Ticket Hub
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  Centralized management
                </p>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/audit-log"
            className="p-4 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/30 transition-colors group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-slate-700 rounded-lg">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-300">
                  Audit Logs
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Security activity
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
