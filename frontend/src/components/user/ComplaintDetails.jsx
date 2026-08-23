import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  FileText,
  User,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
} from "lucide-react";
import api from "../../services/api";
import Loader from "../common/Loader";
import FeedbackForm from "./FeedbackForm";
import { useAuth } from "../../hooks/useAuth";

const ComplaintDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const backRoute = ["org_admin", "super_admin"].includes(user?.role)
    ? "/admin/complaints"
    : user?.role === "staff"
      ? "/staff/complaints"
      : "/complaints";

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const { data } = await api.get(`/complaints/${id}`);
        setComplaint(data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
    const poll = setInterval(fetchDetails, 5000);
    return () => clearInterval(poll);
  }, [id]);

  useEffect(() => {
    const liveTimer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(liveTimer);
  }, []);

  const formatWorkedSeconds = (seconds) => {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const hrs = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getWorkedTime = () => {
    const base = complaint?.workTracking?.totalSeconds || 0;
    const startedAt = complaint?.workTracking?.activeSessionStartedAt;
    if (!startedAt) {
      return { time: formatWorkedSeconds(base), active: false };
    }
    const live = Math.floor(
      (Date.now() - new Date(startedAt).getTime()) / 1000,
    );
    return {
      time: formatWorkedSeconds(base + Math.max(0, live)),
      active: true,
    };
  };

  if (loading) return <Loader fullScreen text="Loading details..." />;
  if (!complaint)
    return <div className="text-center py-20">Complaint not found.</div>;

  return (
    <main
      aria-labelledby="complaint-details-title"
      className="max-w-5xl mx-auto space-y-6 pb-12"
      data-live-tick={tick}
    >
      <Link
        to={backRoute}
        className="inline-flex items-center text-sm text-gray-500 hover:text-primary transition-colors"
      >
        <ArrowLeft aria-hidden="true" className="w-4 h-4 mr-1" /> Back to list
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-mono font-bold text-primary mb-1 block">
                  {complaint.complaintId}
                </span>
                <h1
                  id="complaint-details-title"
                  className="text-2xl font-bold text-gray-900"
                >
                  {complaint.title}
                </h1>
              </div>
              <div className="flex items-center space-x-2">
                <span
                  aria-label={`Current status ${complaint.status}`}
                  className="capitalize px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold border border-blue-100"
                >
                  {complaint.status}
                </span>
              </div>
            </div>

            <div className="prose prose-blue max-w-none text-gray-700 whitespace-pre-wrap">
              {complaint.description}
            </div>

            {user?.role === "user" &&
              !["resolved", "closed"].includes(complaint.status) && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <Link
                    to={`/payments/my-payments?complaintId=${complaint._id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    Pay Priority Fee
                  </Link>
                  <p className="text-xs text-gray-500 mt-2">
                    Use payment to boost handling priority for this complaint.
                  </p>
                </div>
              )}

            {/* Attachments */}
            {complaint.attachments?.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText aria-hidden="true" className="w-4 h-4 mr-2" />{" "}
                  Attachments
                </h3>
                <div className="flex flex-wrap gap-3">
                  {complaint.attachments.map((file, idx) => (
                    <a
                      key={idx}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open attachment ${file.originalName}`}
                      className="flex items-center px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-600 transition-colors border border-gray-200"
                    >
                      <FileText
                        aria-hidden="true"
                        className="w-4 h-4 mr-2 text-gray-400"
                      />
                      <span className="max-w-[150px] truncate">
                        {file.originalName}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Resolution Details */}
          {complaint.status === "resolved" && (
            <section
              aria-label="Resolution details"
              className="bg-green-50 border border-green-100 rounded-xl p-6 shadow-sm"
            >
              <h3 className="text-lg font-bold text-green-800 mb-3 flex items-center">
                <CheckCircle2 aria-hidden="true" className="w-5 h-5 mr-2" />{" "}
                Resolution Provided
              </h3>
              <p className="text-green-700 italic mb-6">
                "{complaint.resolution?.remarks}"
              </p>

              {!complaint.feedback ? (
                <FeedbackForm
                  complaintId={complaint._id}
                  onSuccess={() => window.location.reload()}
                />
              ) : (
                <div className="pt-4 border-t border-green-200">
                  <p className="text-sm text-green-600" aria-live="polite">
                    You rated this resolution:{" "}
                    <strong>{complaint.feedback.rating}/5 stars</strong>
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">
              Tracking Information
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Submitted On</span>
                <span className="font-medium text-gray-900">
                  {new Date(complaint.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Category</span>
                <span className="font-medium text-gray-900">
                  {complaint.category?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Priority</span>
                <span className="font-medium text-gray-900 capitalize">
                  {complaint.priority}
                </span>
              </div>
              <div className="pt-4 border-t flex items-center justify-between">
                <span className="text-gray-500">Assignee</span>
                <div className="flex items-center text-primary font-medium">
                  {complaint.assignedTo ? (
                    <>
                      {" "}
                      <User className="w-4 h-4 mr-1" />{" "}
                      {complaint.assignedTo.name}{" "}
                    </>
                  ) : (
                    "Not Assigned Yet"
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Work Time</span>
                <span className="font-medium text-gray-900 flex items-center gap-2">
                  {getWorkedTime().time}
                  {getWorkedTime().active && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                      Live
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <aside
            className="bg-blue-50 rounded-xl p-6 border border-blue-100"
            aria-label="Help section"
          >
            <h3 className="text-sm font-bold text-blue-900 mb-2">Need help?</h3>
            <p className="text-xs text-blue-700 mb-4">
              If this issue is an emergency, please use our instant hotline
              instead.
            </p>
            <a
              href={`mailto:support@crsportal.com?subject=Help with Complaint ${complaint.complaintId}`}
              className="block w-full py-2 bg-white text-blue-600 text-sm font-bold rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors text-center"
            >
              Contact Support
            </a>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default ComplaintDetails;
