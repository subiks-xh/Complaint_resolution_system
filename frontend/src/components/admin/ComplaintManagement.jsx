import { useState, useEffect, useCallback } from "react";
import { Search, Filter, UserCheck, ExternalLink } from "lucide-react";
import api from "../../services/api";
import Loader from "../common/Loader";
import AssignmentPanel from "./AssignmentPanel";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";

const ComplaintManagement = () => {
  const [complaints, setComplaints] = useState([]);
  const [paymentByComplaint, setPaymentByComplaint] = useState({});
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    category: "",
    priority: "",
    assignedTo: "",
    dateRange: "",
  });

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        sortBy: "createdAt",
        sortOrder: "desc",
      };
      const { data } = await api.get("/admin/complaints", { params });
      const nextComplaints = data.data.complaints || [];
      setComplaints(nextComplaints);

      const complaintIds = nextComplaints
        .map((item) => item._id)
        .filter(Boolean);
      if (complaintIds.length > 0) {
        const paymentRes = await api.get("/payments/complaints/status", {
          params: { complaintIds: complaintIds.join(",") },
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });
        setPaymentByComplaint(paymentRes.data?.data || {});
      } else {
        setPaymentByComplaint({});
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load complaints");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchComplaints();
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchComplaints]);

  useEffect(() => {
    const liveTick = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(liveTick);
  }, []);

  const formatWorkedSeconds = (seconds) => {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const hrs = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getWorkTime = (complaint) => {
    const base = complaint?.workTracking?.totalSeconds || 0;
    const startedAt = complaint?.workTracking?.activeSessionStartedAt;
    if (!startedAt) {
      return { duration: formatWorkedSeconds(base), active: false };
    }
    const live = Math.floor(
      (Date.now() - new Date(startedAt).getTime()) / 1000,
    );
    return {
      duration: formatWorkedSeconds(base + Math.max(0, live)),
      active: true,
    };
  };

  const getPaymentBadge = (complaintId) => {
    const paymentInfo = paymentByComplaint[complaintId];
    if (!paymentInfo) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
          none
        </span>
      );
    }

    const styles = {
      paid: "bg-green-100 text-green-700",
      initiated: "bg-yellow-100 text-yellow-700",
      failed: "bg-red-100 text-red-700",
      refunded: "bg-gray-200 text-gray-700",
    };

    return (
      <div className="flex items-center gap-2">
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[paymentInfo.latestStatus] || "bg-gray-100 text-gray-700"}`}
        >
          {paymentInfo.latestStatus}
        </span>
        {paymentInfo.paidAmount > 0 && (
          <span className="text-xs font-medium text-gray-600">
            ${paymentInfo.paidAmount}
          </span>
        )}
      </div>
    );
  };

  const openAssignment = (complaint) => {
    console.log("Opening assignment for complaint:", complaint);
    console.log("Complaint properties:", Object.keys(complaint || {}));
    console.log("Complaint category:", complaint?.category);
    console.log("Complaint user:", complaint?.user);
    console.log("Complaint createdAt:", complaint?.createdAt);
    console.log("Complaint priority:", complaint?.priority);
    setSelectedComplaint(complaint);
    setIsAssignOpen(true);
  };

  return (
    <div className="space-y-6" data-live-tick={tick}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Complaint Management
        </h1>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ID, title, user..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full md:w-64 outline-none focus:ring-2 focus:ring-primary/20 text-gray-900 bg-white placeholder-gray-500"
              onBlur={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <button
            onClick={fetchComplaints}
            title="Refresh complaints"
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <Loader text="Syncing data..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Complaint ID
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Work Time
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Staff
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {complaints.map((c) => (
                  <tr
                    key={c._id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-mono font-bold text-primary">
                        {c.complaintId}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900 leading-none">
                        {c.user?.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {c.user?.email}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {c.category?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          c.status === "new"
                            ? "bg-blue-100 text-blue-700"
                            : c.status === "escalated"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">{getPaymentBadge(c._id)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-gray-700">
                          {getWorkTime(c).duration}
                        </span>
                        {getWorkTime(c).active && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                            live
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {c.assignedTo ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold">
                            {c.assignedTo.name.charAt(0)}
                          </div>
                          <span className="text-sm text-gray-700">
                            {c.assignedTo.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-gray-400">
                          Not assigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openAssignment(c)}
                          className="p-1.5 text-primary hover:bg-blue-50 rounded transition-colors"
                          title="Assign Staff"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <Link
                          to={`/complaints/${c._id}`}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                          title="View Detail"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {isAssignOpen && selectedComplaint && (
        <AssignmentPanel
          complaint={selectedComplaint}
          onClose={() => setIsAssignOpen(false)}
          onAssigned={() => {
            setIsAssignOpen(false);
            fetchComplaints();
          }}
        />
      )}
    </div>
  );
};

export default ComplaintManagement;
