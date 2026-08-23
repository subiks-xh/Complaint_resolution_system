import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Calendar, Download } from "lucide-react";
import api from "../../services/api";
import Loader from "../common/Loader";
import { toast } from "react-hot-toast";

const AnalyticsPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/analytics?period=30d");
      setData(data.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!data?.complaintTrends?.length) {
      toast.error("No analytics data available to export");
      return;
    }

    const rows = data.complaintTrends.map((item) => ({
      date: item._id,
      submitted: item.submitted ?? 0,
      resolved: item.resolved ?? 0,
    }));

    const csv = [
      "date,submitted,resolved",
      ...rows.map((row) => `${row.date},${row.submitted},${row.resolved}`),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Analytics report exported");
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) return <Loader text="Processing big data..." />;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Performance Analytics
        </h1>
        <div className="flex space-x-3">
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold flex items-center hover:bg-gray-50"
          >
            <Calendar className="w-4 h-4 mr-2" /> Last 30 Days
          </button>
          <button
            onClick={exportReport}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold flex items-center hover:bg-gray-800"
          >
            <Download className="w-4 h-4 mr-2" /> Export Report
          </button>
        </div>
      </div>

      {/* Resolution Trend Chart */}
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900">
            Volume vs Resolution Trend
          </h3>
          <p className="text-sm text-gray-500">
            Daily breakdown of incoming vs resolved complaints.
          </p>
        </div>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.complaintTrends}>
              <defs>
                <linearGradient id="colorSub" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f3f4f6"
              />
              <XAxis
                dataKey="_id"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                }}
              />
              <Area
                type="monotone"
                dataKey="submitted"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorSub)"
                strokeWidth={3}
              />
              <Area
                type="monotone"
                dataKey="resolved"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorRes)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Additional Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-lg">
          <h4 className="opacity-80 text-sm font-medium">SLA Compliance</h4>
          <p className="text-3xl font-bold mt-2">
            {Math.round(data?.slaMetrics?.slaComplianceRate || 0)}%
          </p>
          <div className="mt-4 h-1.5 w-full bg-blue-400 rounded-full overflow-hidden">
            <div
              className="bg-white h-full"
              style={{ width: `${data?.slaMetrics?.slaComplianceRate}%` }}
            ></div>
          </div>
        </div>
        {/* ... More metric cards can go here */}
      </div>
    </div>
  );
};

export default AnalyticsPanel;
