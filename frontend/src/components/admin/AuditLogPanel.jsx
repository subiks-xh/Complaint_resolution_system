import { useEffect, useState } from "react";
import { Activity, Calendar, RefreshCw, Search, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import Loader from "../common/Loader";

const AuditLogPanel = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 20,
  });
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    actorRole: "",
    action: "",
    startDate: "",
    endDate: "",
  });

  const loadAuditLogs = async ({ silent = false, params } = {}) => {
    const queryParams = params || filters;

    if (!silent) {
      setLoading(true);
    }

    try {
      const { data } = await api.get("/admin/audit-log", {
        params: queryParams,
      });
      setEntries(data.data.entries || []);
      setPagination(
        data.data.pagination || {
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          limit: 20,
        },
      );
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch audit logs",
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [filters.page]);

  const applyFilters = async () => {
    const nextFilters = { ...filters, page: 1 };
    setFilters(nextFilters);
    await loadAuditLogs({ params: nextFilters });
  };

  const resetFilters = async () => {
    const defaults = {
      page: 1,
      limit: 20,
      actorRole: "",
      action: "",
      startDate: "",
      endDate: "",
    };

    setFilters(defaults);
    await loadAuditLogs({ params: defaults });
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadAuditLogs({ silent: true });
  };

  if (loading) {
    return <Loader fullScreen text="Loading audit logs..." />;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-slate-200 text-sm font-medium">
              Security Monitoring
            </p>
            <h1 className="text-3xl font-bold mt-1">Audit Logs</h1>
            <p className="text-slate-200 mt-2 max-w-2xl">
              Track role actions, request paths, status codes, and change
              activity across your organization.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/20 disabled:opacity-60"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span>{refreshing ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <input
            value={filters.action}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, action: event.target.value }))
            }
            placeholder="Search action (e.g. DELETE /api/...)"
            className="rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
          />
          <select
            value={filters.actorRole}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, actorRole: event.target.value }))
            }
            className="rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">All roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="org_admin">Org Admin</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="user">User</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, startDate: event.target.value }))
            }
            className="rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, endDate: event.target.value }))
            }
            className="rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
          />
          <button
            onClick={applyFilters}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 text-white hover:bg-slate-900 px-3 py-2"
          >
            <Search className="w-4 h-4" />
            Apply
          </button>
          <button
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-2"
          >
            <X className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Activity Entries
            </h2>
            <p className="text-sm text-gray-500">
              Total entries: {pagination.totalItems}
            </p>
          </div>
          <Activity className="w-5 h-5 text-gray-400" />
        </div>

        {entries.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No audit logs found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">Actor</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {entry.actorId?.name || entry.actorName || "System"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-700 capitalize">
                        {entry.actorRole || "system"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{entry.action}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${entry.statusCode < 400 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {entry.statusCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {entry.ip || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-500 inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Page {pagination.currentPage} of{" "}
            {Math.max(pagination.totalPages, 1)}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  page: Math.max(1, prev.page - 1),
                }))
              }
              disabled={pagination.currentPage <= 1}
              className="px-3 py-1 text-sm rounded-lg border border-gray-200 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  page: Math.min(
                    pagination.totalPages || prev.page,
                    prev.page + 1,
                  ),
                }))
              }
              disabled={pagination.currentPage >= pagination.totalPages}
              className="px-3 py-1 text-sm rounded-lg border border-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogPanel;
