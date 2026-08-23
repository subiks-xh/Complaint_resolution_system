import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  Download,
  Calendar,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Target,
  Filter,
} from "lucide-react";
import api from "../../services/api";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "react-hot-toast";

const ReportingModule = () => {
  const [reports, setReports] = useState({
    overview: null,
    trends: null,
    performance: null,
    categories: null,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    endDate: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  const [filters, setFilters] = useState({
    category: "",
    priority: "",
    status: "",
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/reports", {
        params: { ...dateRange, ...filters },
      });
      setReports(data.data);
    } catch (err) {
      toast.error("Failed to load reports");
      console.error("Reports error:", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, filters]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const exportReport = async (type = "pdf") => {
    try {
      const response = await api.get(`/admin/reports/export`, {
        params: { ...dateRange, ...filters, format: type },
        responseType: "blob",
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `complaint-report-${Date.now()}.${type}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`Report exported as ${type.toUpperCase()}`);
    } catch (err) {
      toast.error("Failed to export report");
    }
  };

  const setQuickDateRange = (days) => {
    const endDate = new Date();
    const startDate = subDays(endDate, days);
    setDateRange({
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    });
  };

  const COLORS = ["#3B82F6", "#EF4444", "#F59E0B", "#10B981", "#8B5CF6"];

  const calculateGrowth = (current, previous) => {
    if (!previous) return 0;
    return (((current - previous) / previous) * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Performance Reports</h1>
            <p className="text-purple-100">
              Comprehensive analytics and historical insights
            </p>
          </div>
          <TrendingUp className="w-12 h-12 text-purple-200" />
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Quick Date Ranges */}
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Quick:</span>
              {[
                { label: "7D", days: 7 },
                { label: "30D", days: 30 },
                { label: "90D", days: 90 },
              ].map(({ label, days }) => (
                <button
                  key={days}
                  onClick={() => setQuickDateRange(days)}
                  className="px-3 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Custom Date Range */}
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
                }
                className="px-3 py-1 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="px-3 py-1 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filters.priority}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, priority: e.target.value }))
                }
                className="px-3 py-1 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              >
                <option value="" className="text-gray-500">All Priorities</option>
                <option value="low" className="text-gray-900">Low</option>
                <option value="medium" className="text-gray-900">Medium</option>
                <option value="high" className="text-gray-900">High</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => exportReport("pdf")}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-xl transition-colors flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>PDF</span>
              </button>
              <button
                onClick={() => exportReport("excel")}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-xl transition-colors flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Excel</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border">
        <div className="border-b bg-gray-50">
          <div className="flex space-x-8 px-6">
            {[
              { id: "overview", label: "Overview", icon: Target },
              { id: "trends", label: "Trends", icon: TrendingUp },
              { id: "performance", label: "Performance", icon: Users },
              { id: "categories", label: "Categories", icon: CheckCircle },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <TrendingUp className="w-8 h-8 animate-pulse text-gray-400" />
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === "overview" && reports.overview && (
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      {
                        title: "Total Complaints",
                        value: reports.overview.totalComplaints,
                        growth: calculateGrowth(
                          reports.overview.totalComplaints,
                          reports.overview.previousTotal
                        ),
                        icon: AlertTriangle,
                        color: "blue",
                      },
                      {
                        title: "Resolved",
                        value: reports.overview.resolvedComplaints,
                        growth: calculateGrowth(
                          reports.overview.resolvedComplaints,
                          reports.overview.previousResolved
                        ),
                        icon: CheckCircle,
                        color: "green",
                      },
                      {
                        title: "Avg. Resolution Time",
                        value: `${reports.overview.avgResolutionTime}h`,
                        growth: calculateGrowth(
                          reports.overview.avgResolutionTime,
                          reports.overview.previousAvgTime
                        ),
                        icon: Clock,
                        color: "orange",
                        reverse: true,
                      },
                      {
                        title: "Satisfaction Score",
                        value: `${reports.overview.satisfactionScore}%`,
                        growth: calculateGrowth(
                          reports.overview.satisfactionScore,
                          reports.overview.previousSatisfaction
                        ),
                        icon: Target,
                        color: "purple",
                      },
                    ].map((card) => (
                      <div key={card.title} className="bg-white border rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className={`p-2 rounded-xl bg-${card.color}-100`}>
                            <card.icon className={`w-5 h-5 text-${card.color}-600`} />
                          </div>
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded-full ${
                              (card.reverse ? card.growth < 0 : card.growth > 0)
                                ? "bg-green-100 text-green-700"
                                : card.growth < 0
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {card.growth > 0 && !card.reverse && "+"}
                            {card.growth}%
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 mb-1">
                          {card.value}
                        </div>
                        <div className="text-sm text-gray-500">{card.title}</div>
                      </div>
                    ))}
                  </div>

                  {/* Resolution Trend Chart */}
                  <div className="bg-white border rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      Resolution Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={reports.overview.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => format(new Date(value), "MM/dd")}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          labelFormatter={(value) => format(new Date(value), "MMM dd, yyyy")}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="submitted"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          name="Submitted"
                        />
                        <Line
                          type="monotone"
                          dataKey="resolved"
                          stroke="#10B981"
                          strokeWidth={2}
                          name="Resolved"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Trends Tab */}
              {activeTab === "trends" && reports.trends && (
                <div className="space-y-6">
                  {/* Monthly Comparison */}
                  <div className="bg-white border rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      Monthly Comparison
                    </h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={reports.trends.monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="submitted" fill="#3B82F6" name="Submitted" />
                        <Bar dataKey="resolved" fill="#10B981" name="Resolved" />
                        <Bar dataKey="escalated" fill="#EF4444" name="Escalated" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Response Time Trend */}
                  <div className="bg-white border rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      Response Time Trend (Hours)
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={reports.trends.responseTimeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => format(new Date(value), "MM/dd")}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          labelFormatter={(value) => format(new Date(value), "MMM dd, yyyy")}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="avgResponseTime"
                          stroke="#F59E0B"
                          strokeWidth={2}
                          name="Avg Response Time"
                        />
                        <Line
                          type="monotone"
                          dataKey="slaTarget"
                          stroke="#EF4444"
                          strokeDasharray="5 5"
                          strokeWidth={1}
                          name="SLA Target"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Performance Tab */}
              {activeTab === "performance" && reports.performance && (
                <div className="space-y-6">
                  {/* Staff Performance */}
                  <div className="bg-white border rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      Top Performing Staff
                    </h3>
                    <div className="space-y-4">
                      {reports.performance.topStaff.map((staff, index) => (
                        <div
                          key={staff._id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {staff.firstName} {staff.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {staff.email}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              {staff.resolvedCount}
                            </div>
                            <div className="text-sm text-gray-500">
                              {staff.avgResolutionTime}h avg
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resolution Rate by Priority */}
                  <div className="bg-white border rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      Resolution Rate by Priority
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reports.performance.priorityData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="priority" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="rate" fill="#8B5CF6" name="Resolution Rate %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Categories Tab */}
              {activeTab === "categories" && reports.categories && (
                <div className="space-y-6">
                  {/* Category Distribution */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white border rounded-2xl p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">
                        Complaints by Category
                      </h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={reports.categories.distribution}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {reports.categories.distribution.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-white border rounded-2xl p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">
                        Category Performance
                      </h3>
                      <div className="space-y-4">
                        {reports.categories.performance.map((category) => (
                          <div key={category._id} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-gray-900">
                                {category.name}
                              </span>
                              <span className="text-gray-500">
                                {category.resolutionRate}% resolved
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${category.resolutionRate}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-gray-500">
                              Avg time: {category.avgResolutionTime}h
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Category Trend */}
                  <div className="bg-white border rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      Category Volume Trend
                    </h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={reports.categories.trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => format(new Date(value), "MM/dd")}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          labelFormatter={(value) => format(new Date(value), "MMM dd, yyyy")}
                        />
                        <Legend />
                        {reports.categories.distribution.map((category, index) => (
                          <Bar
                            key={category.name}
                            dataKey={category.name}
                            fill={COLORS[index % COLORS.length]}
                            stackId="category"
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportingModule;