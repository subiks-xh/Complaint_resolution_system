import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  Clock,
  User,
  ArrowUpRight,
  Play,
  Pause,
  Square,
  CheckCircle2,
  MessageSquare,
  FileText,
  AlertTriangle,
  Timer,
  Users,
  Phone,
  Mail,
  Upload,
  Download,
  MoreHorizontal,
  BarChart3,
  TrendingUp,
  Calendar,
  Bell,
  Target,
  Edit3,
  Send,
  Paperclip,
  Flag,
  Eye,
  RefreshCw,
  Zap,
  ChevronDown,
  ChevronUp,
  Settings,
  IndianRupee,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import api from "../../services/api";
import Loader from "../common/Loader";

// Priority color mapping
const getPriorityColor = (priority) => {
  const colors = {
    critical: "bg-red-100 text-red-800 border-red-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-green-100 text-green-800 border-green-200",
  };
  return colors[priority] || "bg-gray-100 text-gray-800 border-gray-200";
};

// Status color mapping
const getStatusColor = (status) => {
  const colors = {
    assigned: "bg-blue-100 text-blue-800",
    "in-progress": "bg-purple-100 text-purple-800",
    "on-hold": "bg-yellow-100 text-yellow-800",
    "pending-user": "bg-orange-100 text-orange-800",
    resolved: "bg-green-100 text-green-800",
    escalated: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
};

// Calculate SLA status
const calculateSLAStatus = (createdAt, dueDate) => {
  const now = new Date();
  const due = new Date(dueDate);
  const minutesRemaining = differenceInMinutes(due, now);

  if (minutesRemaining < 0)
    return { status: "overdue", class: "text-red-600", text: "Overdue" };
  if (minutesRemaining < 60)
    return {
      status: "critical",
      class: "text-red-600",
      text: `${minutesRemaining}m left`,
    };
  if (minutesRemaining < 240)
    return {
      status: "warning",
      class: "text-orange-600",
      text: `${Math.floor(minutesRemaining / 60)}h ${minutesRemaining % 60}m left`,
    };
  return {
    status: "good",
    class: "text-green-600",
    text: `${Math.floor(minutesRemaining / 60)}h left`,
  };
};

const AssignedComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedComplaint, setExpandedComplaint] = useState(null);
  const [activeTimers, setActiveTimers] = useState({});
  const [workingSessions, setWorkingSessions] = useState({});
  const [filters, setFilters] = useState({
    status: "", // Empty string to show all complaints
    priority: "",
    search: "",
    sortBy: "dueDate",
    sortOrder: "asc",
  });
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    completed: 0,
    avgResolutionTime: 0,
    slaCompliance: 0,
  });
  const [noteText, setNoteText] = useState({});
  const [progressValues, setProgressValues] = useState({});
  const [showFileUpload, setShowFileUpload] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [paymentByComplaint, setPaymentByComplaint] = useState({});
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [paymentActionLoading, setPaymentActionLoading] = useState({});
  const [tick, setTick] = useState(0);

  // Load saved timer states from localStorage
  useEffect(() => {
    const savedTimers = localStorage.getItem("complaint-timers");
    if (savedTimers) {
      setActiveTimers(JSON.parse(savedTimers));
    }
    const savedSessions = localStorage.getItem("work-sessions");
    if (savedSessions) {
      setWorkingSessions(JSON.parse(savedSessions));
    }
  }, []);

  // Save timer states to localStorage
  useEffect(() => {
    localStorage.setItem("complaint-timers", JSON.stringify(activeTimers));
  }, [activeTimers]);

  useEffect(() => {
    localStorage.setItem("work-sessions", JSON.stringify(workingSessions));
  }, [workingSessions]);

  const fetchAssignedComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};

      // Only add non-empty filters to params
      if (filters.status && filters.status !== "all") {
        params.status = filters.status;
      }
      if (filters.priority) {
        params.priority = filters.priority;
      }
      if (filters.search) {
        params.search = filters.search;
      }
      if (filters.sortBy) {
        params.sortBy = filters.sortBy;
        params.sortOrder = filters.sortOrder;
      }

      console.log("Fetching complaints with params:", params);
      const { data } = await api.get("/staff/complaints", { params });

      const complaintsData = data.data?.complaints || data.data || [];
      setComplaints(complaintsData);

      const complaintIds = complaintsData
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

      // Calculate stats
      const total = complaintsData.length;
      const inProgress = complaintsData.filter(
        (c) => c.status === "in-progress",
      ).length;
      const completed = complaintsData.filter(
        (c) => c.status === "resolved",
      ).length;

      setStats({
        total,
        inProgress,
        completed,
        avgResolutionTime: data.data?.avgResolutionTime || 0,
        slaCompliance: data.data?.slaCompliance || 0,
      });
    } catch (err) {
      console.error("Error fetching complaints:", err);
      toast.error("Failed to fetch complaints");
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAssignedComplaints();
  }, [fetchAssignedComplaints]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchAssignedComplaints();
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchAssignedComplaints]);

  useEffect(() => {
    const liveTick = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(liveTick);
  }, []);

  const renderPaymentBadge = (complaintId) => {
    const paymentInfo = paymentByComplaint[complaintId];
    if (!paymentInfo) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
          Payment: none
        </span>
      );
    }

    const classes = {
      paid: "bg-green-100 text-green-700",
      initiated: "bg-yellow-100 text-yellow-700",
      failed: "bg-red-100 text-red-700",
      refunded: "bg-gray-200 text-gray-700",
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${classes[paymentInfo.latestStatus] || "bg-gray-100 text-gray-700"}`}
      >
        Payment: {paymentInfo.latestStatus}
      </span>
    );
  };

  const setPaymentDraftField = (complaintId, field, value) => {
    setPaymentDrafts((prev) => ({
      ...prev,
      [complaintId]: {
        ...(prev[complaintId] || {}),
        [field]: value,
      },
    }));
  };

  const requestComplaintPayment = async (complaint) => {
    const complaintId = complaint._id;
    const draft = paymentDrafts[complaintId] || {};
    const defaultAmountByPriority = {
      low: 99,
      medium: 199,
      high: 299,
      critical: 399,
    };
    const amount = Number(
      draft.amount || defaultAmountByPriority[complaint.priority] || 199,
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    try {
      setPaymentActionLoading((prev) => ({ ...prev, [complaintId]: true }));
      await api.post(`/staff/complaints/${complaintId}/request-payment`, {
        amount,
        method: draft.method || "online",
        notes: draft.notes || "",
      });

      toast.success("Payment request sent to user");
      fetchAssignedComplaints();
    } catch (err) {
      console.error("Request complaint payment error:", err);
      toast.error(err.response?.data?.message || "Failed to request payment");
    } finally {
      setPaymentActionLoading((prev) => ({ ...prev, [complaintId]: false }));
    }
  };

  const acknowledgeComplaintPayment = async (complaint) => {
    const complaintId = complaint._id;
    const draft = paymentDrafts[complaintId] || {};

    try {
      setPaymentActionLoading((prev) => ({ ...prev, [complaintId]: true }));
      await api.post(`/staff/complaints/${complaintId}/acknowledge-payment`, {
        remarks: draft.ackRemarks || "Payment verified by assigned staff",
      });

      toast.success(
        "Payment acknowledged. Admin can now close this complaint.",
      );
      fetchAssignedComplaints();
    } catch (err) {
      console.error("Acknowledge complaint payment error:", err);
      toast.error(
        err.response?.data?.message || "Failed to acknowledge payment",
      );
    } finally {
      setPaymentActionLoading((prev) => ({ ...prev, [complaintId]: false }));
    }
  };

  const startTimer = (complaintId) => {
    // Check if timer is already running
    const currentTimer = activeTimers[complaintId];
    if (currentTimer && currentTimer.isRunning) {
      toast.info("Timer is already running for this complaint");
      return;
    }

    const startTime = Date.now();

    api
      .post(`/staff/complaints/${complaintId}/work-session/start`)
      .then(({ data }) => {
        const totalFromServer =
          data?.data?.workTracking?.totalSeconds ||
          data?.data?.workTracking?.currentWorkedSeconds ||
          0;

        setWorkingSessions((prev) => ({
          ...prev,
          [complaintId]: {
            ...prev[complaintId],
            totalTime: totalFromServer,
          },
        }));

        setActiveTimers((prev) => ({
          ...prev,
          [complaintId]: {
            startTime,
            isRunning: true,
            elapsed: totalFromServer,
          },
        }));

        updateComplaintStatus(complaintId, "in-progress");
        toast.success("Timer started - Working on complaint");
      })
      .catch((err) => {
        console.error("Start work-session error:", err);
        toast.error(err.response?.data?.message || "Failed to start timer");
      });
  };

  const pauseTimer = (complaintId) => {
    const timer = activeTimers[complaintId];
    if (timer && timer.isRunning) {
      api
        .post(`/staff/complaints/${complaintId}/work-session/pause`)
        .then(({ data }) => {
          const elapsed =
            data?.data?.workTracking?.totalSeconds ||
            timer.elapsed + (Date.now() - timer.startTime) / 1000;

          setActiveTimers((prev) => ({
            ...prev,
            [complaintId]: { ...timer, isRunning: false, elapsed },
          }));

          setWorkingSessions((prev) => ({
            ...prev,
            [complaintId]: {
              ...prev[complaintId],
              totalTime: elapsed,
              lastSession: Date.now(),
            },
          }));

          toast.info("Timer paused - Work session saved");
        })
        .catch((err) => {
          console.error("Pause work-session error:", err);
          toast.error(err.response?.data?.message || "Failed to pause timer");
        });
    }
  };

  const stopTimer = (complaintId) => {
    const timer = activeTimers[complaintId];
    if (timer) {
      const finalize = (finalTime) => {
        setWorkingSessions((prev) => ({
          ...prev,
          [complaintId]: {
            ...prev[complaintId],
            totalTime: finalTime,
            completedAt: Date.now(),
          },
        }));

        setActiveTimers((prev) => {
          const newTimers = { ...prev };
          delete newTimers[complaintId];
          return newTimers;
        });

        toast.success(
          `Work completed - Total time: ${formatTime(Math.floor(finalTime))}`,
        );
      };

      if (timer.isRunning) {
        api
          .post(`/staff/complaints/${complaintId}/work-session/pause`)
          .then(({ data }) => {
            const finalTime =
              data?.data?.workTracking?.totalSeconds ||
              timer.elapsed + (Date.now() - timer.startTime) / 1000;
            finalize(finalTime);
          })
          .catch((err) => {
            console.error("Stop work-session error:", err);
            const fallback =
              timer.elapsed + (Date.now() - timer.startTime) / 1000;
            finalize(fallback);
          });
      } else {
        finalize(timer.elapsed);
      }
    }
  };

  const updateComplaintStatus = async (complaintId, newStatus, notes = "") => {
    try {
      console.log(`Updating complaint ${complaintId} to status: ${newStatus}`);

      const payload = {
        status: newStatus,
      };

      if (notes) {
        payload.notes = notes;
      }

      await api.put(`/staff/complaints/${complaintId}/status`, payload);

      // Update local state
      setComplaints((prev) =>
        prev.map((c) =>
          c._id === complaintId ? { ...c, status: newStatus } : c,
        ),
      );

      toast.success(`Status updated to ${newStatus.replace("-", " ")}`);
    } catch (err) {
      console.error("Status update error:", err);
      const errorMessage =
        err.response?.data?.message || "Failed to update status";
      toast.error(errorMessage);
    }
  };

  const updateProgress = async (complaintId, progress, notes = "") => {
    try {
      console.log(
        `Updating progress for complaint ${complaintId} to ${progress}%`,
      );

      // For now, we'll add this as an internal note since there might not be a progress endpoint
      await api.post(`/staff/complaints/${complaintId}/notes`, {
        note: `Progress updated to ${progress}%${notes ? ": " + notes : ""}`,
      });

      // Update local state
      setComplaints((prev) =>
        prev.map((c) =>
          c._id === complaintId ? { ...c, progress: progress } : c,
        ),
      );

      toast.success(`Progress updated to ${progress}%`);
    } catch (err) {
      console.error("Progress update error:", err);
      toast.error("Progress logged as note");
    }
  };

  const addWorkNote = async (complaintId, noteContent) => {
    if (!noteContent.trim()) {
      toast.error("Please enter a note");
      return;
    }

    try {
      console.log(`Adding note to complaint ${complaintId}:`, noteContent);

      await api.post(`/staff/complaints/${complaintId}/notes`, {
        note: noteContent,
      });

      // Clear the note input
      setNoteText((prev) => ({ ...prev, [complaintId]: "" }));

      toast.success("Work note added successfully");
    } catch (err) {
      console.error("Note addition error:", err);
      const errorMessage = err.response?.data?.message || "Failed to add note";
      toast.error(errorMessage);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getCurrentTime = (complaintId) => {
    const timer = activeTimers[complaintId];
    const session = workingSessions[complaintId];

    if (!timer && !session) {
      const complaint = complaints.find((c) => c._id === complaintId);
      const base = complaint?.workTracking?.totalSeconds || 0;
      const startedAt = complaint?.workTracking?.activeSessionStartedAt;
      if (!startedAt) {
        return Math.floor(
          base || complaint?.workTracking?.currentWorkedSeconds || 0,
        );
      }
      const live = Math.floor(
        (Date.now() - new Date(startedAt).getTime()) / 1000,
      );
      return Math.floor(base + Math.max(0, live));
    }

    let totalTime = session?.totalTime || 0;

    if (timer && timer.isRunning) {
      totalTime += (Date.now() - timer.startTime) / 1000;
    } else if (timer) {
      totalTime = timer.elapsed;
    }

    return Math.floor(totalTime);
  };

  const toggleComplaintExpansion = (complaintId) => {
    console.log("Toggling expansion for complaint:", complaintId);
    setExpandedComplaint((prev) => (prev === complaintId ? null : complaintId));
  };

  // Communication functions
  const sendMessageToUser = async (complaintId, message) => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    try {
      await api.post(`/staff/complaints/${complaintId}/messages`, {
        message: message.trim(),
        type: "staff_update",
      });
      toast.success("Message sent to user");
      setMessageText("");
      setShowMessageModal(null);
    } catch (err) {
      console.error("Send message error:", err);
      toast.error("Failed to send message");
    }
  };

  const initiateUserCall = (complaintId) => {
    const complaint = complaints.find((c) => c._id === complaintId);
    const userPhone = complaint?.user?.phone || complaint?.user?.contact?.phone;

    if (userPhone) {
      window.open(`tel:${userPhone}`, "_self");
      toast.success("Initiating call...");
    } else {
      toast.error("User phone number not available");
    }
  };

  const requestHelp = async (complaintId) => {
    try {
      await api.post(`/staff/complaints/${complaintId}/escalate`, {
        reason: "Staff requested assistance",
        escalationType: "help_request",
      });
      toast.success("Help request sent to supervisor");
    } catch (err) {
      console.error("Request help error:", err);
      toast.error("Failed to request help");
    }
  };

  // Resources functions
  const handleFileUpload = async (complaintId, files) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("attachments", file);
      });

      await api.post(`/staff/complaints/${complaintId}/attachments`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Files uploaded successfully");
      setShowFileUpload(null);
      fetchAssignedComplaints(); // Refresh to show new attachments
    } catch (err) {
      console.error("File upload error:", err);
      toast.error("Failed to upload files");
    } finally {
      setIsUploading(false);
    }
  };

  const viewAttachments = (complaintId) => {
    const complaint = complaints.find((c) => c._id === complaintId);
    const attachments = complaint?.attachments;

    if (!attachments || attachments.length === 0) {
      toast.info("No attachments found for this complaint");
      return;
    }

    // Open first attachment or show list
    if (attachments.length === 1) {
      window.open(attachments[0].url || attachments[0].path, "_blank");
    } else {
      toast.success(
        `Found ${attachments.length} attachments - Opening complaint workspace for full view`,
      );
      window.open(`/staff/complaints/${complaintId}`, "_blank");
    }
  };

  const openKnowledgeBase = (complaintId) => {
    const complaint = complaints.find((c) => c._id === complaintId);
    const category = complaint?.category?.name || "general";

    // Open knowledge base in new tab with category filter
    const kbUrl = `/knowledge-base?category=${encodeURIComponent(category)}&search=${encodeURIComponent(complaint?.title || "")}`;
    window.open(kbUrl, "_blank");
    toast.success("Opening relevant knowledge base articles");
  };

  return (
    <div className="space-y-6" data-live-tick={tick}>
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              My Assigned Tasks
            </h1>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-gray-600">
                  Total:{" "}
                  <strong className="text-gray-900">{stats.total}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span className="text-gray-600">
                  In Progress:{" "}
                  <strong className="text-gray-900">{stats.inProgress}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-gray-600">
                  Completed:{" "}
                  <strong className="text-gray-900">{stats.completed}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                <span className="text-gray-600">
                  SLA Compliance:{" "}
                  <strong className="text-gray-900">
                    {stats.slaCompliance}%
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by ID, subject, or user name..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-900 bg-white placeholder-gray-500"
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>

        <div className="flex gap-3">
          <select
            className="px-4 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 bg-white min-w-[140px]"
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            value={filters.status}
          >
            <option value="">All Status</option>
            <option value="assigned">Newly Assigned</option>
            <option value="in-progress">In Progress</option>
            <option value="on-hold">On Hold</option>
            <option value="pending-user">Pending User</option>
            <option value="resolved">Resolved</option>
            <option value="escalated">Escalated</option>
          </select>

          <select
            className="px-4 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 bg-white min-w-[120px]"
            onChange={(e) =>
              setFilters({ ...filters, priority: e.target.value })
            }
            value={filters.priority}
          >
            <option value="">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            className="px-4 py-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 bg-white min-w-[130px]"
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
            value={filters.sortBy}
          >
            <option value="dueDate">Sort by Due Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="createdAt">Sort by Created</option>
            <option value="status">Sort by Status</option>
          </select>
        </div>
      </div>

      {/* Complaints List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
            <Loader text="Loading your assigned tasks..." />
          </div>
        ) : complaints.length > 0 ? (
          complaints.map((complaint) => {
            const isExpanded = expandedComplaint === complaint._id;
            const currentTime = getCurrentTime(complaint._id);
            const timer = activeTimers[complaint._id];
            const slaStatus = calculateSLAStatus(
              complaint.createdAt,
              complaint.dueDate,
            );
            const complaintPayment = paymentByComplaint[complaint._id];
            const paymentWorkflow = complaint.paymentWorkflow || {};
            const paymentStatus =
              paymentWorkflow.paymentStatus ||
              complaintPayment?.latestStatus ||
              "none";
            const canRequestPayment =
              complaint.status === "resolved" &&
              !["requested", "paid", "acknowledged"].includes(paymentStatus);
            const canAcknowledgePayment = paymentStatus === "paid";

            return (
              <div
                key={complaint._id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* Main Complaint Card */}
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* Left: Complaint Info */}
                    <div className="flex-1">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-bold text-sm">
                              {complaint.priority === "critical" && "🚨"}
                              {complaint.priority === "high" && "⚠️"}
                              {complaint.priority === "medium" && "📋"}
                              {complaint.priority === "low" && "📝"}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-sm font-bold text-blue-600">
                              {complaint.complaintId || complaint._id}
                            </span>
                            <span
                              className={`px-2 py-1 text-xs font-medium border rounded-full ${getPriorityColor(complaint.priority)}`}
                            >
                              {complaint.priority?.toUpperCase()}
                            </span>
                            <span
                              className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(complaint.status)}`}
                            >
                              {complaint.status
                                ?.replace("-", " ")
                                .toUpperCase()}
                            </span>
                            {renderPaymentBadge(complaint._id)}
                          </div>

                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {complaint.title || complaint.subject}
                          </h3>

                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {complaint.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              <span>
                                {complaint.user?.name || "Unknown User"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                Created{" "}
                                {formatDistanceToNow(
                                  new Date(complaint.createdAt),
                                  { addSuffix: true },
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span className={slaStatus.class}>
                                {slaStatus.text}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Timer and Controls */}
                    <div className="flex-shrink-0 lg:text-right">
                      {/* Timer Display */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="text-2xl font-mono font-bold text-gray-900 mb-1">
                          {formatTime(currentTime)}
                        </div>
                        <div className="text-xs text-gray-500 mb-3">
                          {timer?.isRunning ? "🔴 Working" : "⏸️ Paused"}
                        </div>

                        {/* Timer Controls */}
                        <div className="flex gap-2">
                          {!timer?.isRunning ? (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log(
                                  "Start button clicked for complaint:",
                                  complaint._id,
                                );
                                startTimer(complaint._id);
                              }}
                              className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                            >
                              <Play className="w-4 h-4" />
                              {currentTime > 0 ? "Resume" : "Start"}
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log(
                                  "Pause button clicked for complaint:",
                                  complaint._id,
                                );
                                pauseTimer(complaint._id);
                              }}
                              className="flex items-center gap-2 px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm"
                            >
                              <Pause className="w-4 h-4" />
                              Pause
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log(
                                "Stop button clicked for complaint:",
                                complaint._id,
                              );
                              stopTimer(complaint._id);
                            }}
                            disabled={!timer && currentTime === 0}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                              !timer && currentTime === 0
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : "bg-red-500 text-white hover:bg-red-600"
                            }`}
                          >
                            <Square className="w-4 h-4" />
                            Stop
                          </button>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log(
                              "More button clicked for complaint:",
                              complaint._id,
                            );
                            toggleComplaintExpansion(complaint._id);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 text-sm font-medium shadow-sm border border-blue-600"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="text-white">
                            {isExpanded ? "Less" : "More"}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        <Link
                          to={`/staff/complaints/${complaint._id}`}
                          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700 hover:text-gray-900 font-medium"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                          <span className="text-gray-700">Open</span>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Progress
                      </span>
                      <span className="text-sm text-gray-500">
                        {complaint.progress || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${complaint.progress || 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-6 bg-gray-50">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Status Management */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          Status Management
                        </h4>

                        <select
                          value={complaint.status}
                          onChange={(e) =>
                            updateComplaintStatus(complaint._id, e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                        >
                          <option value="assigned">📋 Assigned</option>
                          <option value="in-progress">⚙️ In Progress</option>
                          <option value="on-hold">⏸️ On Hold</option>
                          <option value="pending-user">
                            👤 Pending User Response
                          </option>
                          <option value="resolved">✅ Resolved</option>
                          <option value="escalated">🚨 Escalated</option>
                        </select>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Progress Update
                          </label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="10"
                              value={
                                progressValues[complaint._id] ??
                                complaint.progress ??
                                0
                              }
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                setProgressValues((prev) => ({
                                  ...prev,
                                  [complaint._id]: value,
                                }));
                              }}
                              onMouseUp={(e) => {
                                const value = parseInt(e.target.value);
                                updateProgress(complaint._id, value);
                              }}
                              onTouchEnd={(e) => {
                                const value = parseInt(e.target.value);
                                updateProgress(complaint._id, value);
                              }}
                              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                              style={{
                                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${progressValues[complaint._id] ?? complaint.progress ?? 0}%, #E5E7EB ${progressValues[complaint._id] ?? complaint.progress ?? 0}%, #E5E7EB 100%)`,
                              }}
                            />
                            <span className="text-sm font-medium text-gray-700 min-w-[40px] bg-gray-100 px-2 py-1 rounded">
                              {progressValues[complaint._id] ??
                                complaint.progress ??
                                0}
                              %
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Communication */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Communication
                        </h4>

                        <button
                          onClick={() => setShowMessageModal(complaint._id)}
                          className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                          Message User
                        </button>

                        <button
                          onClick={() => initiateUserCall(complaint._id)}
                          className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          Call User
                        </button>

                        <button
                          onClick={() => requestHelp(complaint._id)}
                          className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          <Users className="w-4 h-4" />
                          Request Help
                        </button>
                      </div>

                      {/* Resources */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Resources
                        </h4>

                        <button
                          onClick={() => setShowFileUpload(complaint._id)}
                          className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Upload Files
                        </button>

                        <button
                          onClick={() => viewAttachments(complaint._id)}
                          className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          View Attachments
                          {complaint?.attachments?.length > 0 && (
                            <span className="ml-auto bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full">
                              {complaint.attachments.length}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => openKnowledgeBase(complaint._id)}
                          className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-gray-700 hover:text-gray-900 transition-colors"
                        >
                          <BarChart3 className="w-4 h-4" />
                          Knowledge Base
                        </button>
                      </div>
                    </div>

                    {/* Quick Notes */}
                    <div className="mt-6">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Edit3 className="w-4 h-4" />
                        Add Work Notes
                      </h4>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Add a quick note about your progress..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                          value={noteText[complaint._id] || ""}
                          onChange={(e) =>
                            setNoteText((prev) => ({
                              ...prev,
                              [complaint._id]: e.target.value,
                            }))
                          }
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              addWorkNote(
                                complaint._id,
                                noteText[complaint._id] || "",
                              );
                            }
                          }}
                        />
                        <button
                          onClick={() =>
                            addWorkNote(
                              complaint._id,
                              noteText[complaint._id] || "",
                            )
                          }
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          Add Note
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <IndianRupee className="w-4 h-4" />
                        Payment Workflow
                      </h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Current status: <strong>{paymentStatus}</strong>
                      </p>

                      {canRequestPayment && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
                          <input
                            type="number"
                            min="1"
                            placeholder="Amount"
                            value={paymentDrafts[complaint._id]?.amount || ""}
                            onChange={(e) =>
                              setPaymentDraftField(
                                complaint._id,
                                "amount",
                                e.target.value,
                              )
                            }
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                          />
                          <select
                            value={
                              paymentDrafts[complaint._id]?.method || "online"
                            }
                            onChange={(e) =>
                              setPaymentDraftField(
                                complaint._id,
                                "method",
                                e.target.value,
                              )
                            }
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                          >
                            <option value="online">Online</option>
                            <option value="offline">Offline</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Payment note (optional)"
                            value={paymentDrafts[complaint._id]?.notes || ""}
                            onChange={(e) =>
                              setPaymentDraftField(
                                complaint._id,
                                "notes",
                                e.target.value,
                              )
                            }
                            className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                          />
                        </div>
                      )}

                      {canAcknowledgePayment && (
                        <div className="mb-3">
                          <input
                            type="text"
                            placeholder="Acknowledgement remarks"
                            value={
                              paymentDrafts[complaint._id]?.ackRemarks || ""
                            }
                            onChange={(e) =>
                              setPaymentDraftField(
                                complaint._id,
                                "ackRemarks",
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {canRequestPayment ? (
                          <button
                            onClick={() => requestComplaintPayment(complaint)}
                            disabled={paymentActionLoading[complaint._id]}
                            className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50"
                          >
                            Request Payment
                          </button>
                        ) : null}

                        {canAcknowledgePayment ? (
                          <button
                            onClick={() =>
                              acknowledgeComplaintPayment(complaint)
                            }
                            disabled={paymentActionLoading[complaint._id]}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                          >
                            Acknowledge Payment
                          </button>
                        ) : null}

                        {paymentStatus === "requested" && (
                          <span className="text-sm text-amber-700 bg-amber-100 px-3 py-2 rounded-lg">
                            Waiting for user payment
                          </span>
                        )}

                        {paymentStatus === "acknowledged" && (
                          <span className="text-sm text-green-700 bg-green-100 px-3 py-2 rounded-lg">
                            Payment acknowledged. Ready for admin closure.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No complaints found
            </h3>
            <p className="text-gray-500">
              {filters.search || filters.status || filters.priority
                ? "Try adjusting your filters to see more results."
                : "Great job! You have no assigned complaints at the moment."}
            </p>
          </div>
        )}
      </div>

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Send Message to User
              </h3>

              <div className="space-y-4">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg resize-none text-gray-900 bg-white"
                  autoFocus
                />

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowMessageModal(null);
                      setMessageText("");
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      sendMessageToUser(showMessageModal, messageText)
                    }
                    disabled={!messageText.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Send Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {showFileUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Files
              </h3>

              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">
                    Click to upload files or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF, DOC, DOCX, JPG, PNG up to 10MB each
                  </p>
                  <input
                    type="file"
                    multiple
                    onChange={(e) =>
                      handleFileUpload(showFileUpload, e.target.files)
                    }
                    className="hidden"
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                  <label
                    htmlFor="file-upload"
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                  >
                    Choose Files
                  </label>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowFileUpload(null)}
                    disabled={isUploading}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignedComplaints;
