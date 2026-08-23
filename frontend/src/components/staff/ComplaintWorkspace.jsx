import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  MessageSquare,
  Shield,
  User,
  FileText,
  CheckCircle2,
  History,
  RefreshCw,
} from "lucide-react";
import { Clock } from "lucide-react"; // Explicit import for Clock
import api from "../../services/api";
import Loader from "../common/Loader";
import StatusUpdateForm from "./StatusUpdateForm";
import ResolutionCopilot from "./ResolutionCopilot";

const ComplaintWorkspace = () => {
  const { id } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetails = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      // Validate ID parameter
      if (!id || id === "undefined" || id === "null") {
        throw new Error("Invalid complaint ID");
      }

      const { data } = await api.get(`/staff/complaints/${id}`);

      if (!data || !data.data) {
        throw new Error("No complaint data received");
      }

      setComplaint(data.data);
    } catch (err) {
      console.error("Error fetching complaint details:", err);

      // Provide more specific error messages
      let errorMessage = "Failed to load complaint details";

      if (err.response?.status === 404) {
        errorMessage = "Complaint not found or you don't have access to it";
      } else if (err.response?.status === 403) {
        errorMessage = "You don't have permission to view this complaint";
      } else if (err.response?.status === 401) {
        errorMessage = "Please log in again to view this complaint";
      } else if (err.message === "Invalid complaint ID") {
        errorMessage = "Invalid complaint ID provided";
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  if (loading) return <Loader fullScreen text="Opening workspace..." />;

  if (error)
    return (
      <div
        className="max-w-2xl mx-auto mt-8"
        role="alert"
        aria-live="assertive"
      >
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Error Loading Complaint
          </h2>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex gap-3">
            <Link
              to="/staff/complaints"
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Assignments
            </Link>
            <button
              onClick={fetchDetails}
              className="inline-flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Retry
            </button>
          </div>
        </div>
      </div>
    );

  if (!complaint) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">
            Complaint Not Found
          </h2>
          <p className="text-yellow-700 mb-4">
            The requested complaint could not be found or you may not have
            access to it.
          </p>
          <Link
            to="/staff/complaints"
            className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Assignments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main
      aria-labelledby="staff-complaint-title"
      className="max-w-6xl mx-auto space-y-6 pb-20"
    >
      <Link
        to="/staff/dashboard"
        className="inline-flex items-center text-sm text-gray-500 hover:text-primary transition-colors"
      >
        <ArrowLeft aria-hidden="true" className="w-4 h-4 mr-1" /> Back to
        Dashboard
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Section: Details & Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-mono font-bold text-primary mb-1 block">
                  {complaint.complaintId}
                </span>
                <h1
                  id="staff-complaint-title"
                  className="text-2xl font-bold text-gray-900"
                >
                  {complaint.title}
                </h1>
              </div>
              <span
                aria-label={`Current status ${complaint.status}`}
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  complaint.status === "in-progress"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {complaint.status}
              </span>
            </div>

            <div className="bg-gray-50 rounded-xl p-5 mb-8 text-gray-700 whitespace-pre-wrap leading-relaxed">
              {complaint.description}
            </div>

            {/* User Details Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-xl bg-white mb-8">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">
                    Complainant
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {complaint.user?.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">
                    Category
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {complaint.category?.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Update Form Section */}
            {complaint.status !== "resolved" &&
              complaint.status !== "closed" && (
                <div className="pt-8 border-t border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Resolution Action
                  </h3>
                  <StatusUpdateForm
                    complaint={complaint}
                    onUpdate={() => fetchDetails()}
                  />
                </div>
              )}

            {complaint.status === "resolved" && (
              <div className="p-6 bg-green-50 border border-green-100 rounded-xl">
                <h3 className="text-green-800 font-bold flex items-center mb-2">
                  <CheckCircle2 aria-hidden="true" className="w-5 h-5 mr-2" />{" "}
                  Resolved by You
                </h3>
                <p className="text-green-700 text-sm italic">
                  "{complaint.resolution?.remarks}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Copilot & History */}
        <div className="space-y-6">
          <ResolutionCopilot complaint={complaint} />

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center">
              <History
                aria-hidden="true"
                className="w-5 h-5 mr-2 text-gray-400"
              />{" "}
              Activity History
            </h3>
            <div className="flow-root">
              <ul className="-mb-8">
                {complaint.statusHistory?.map((event, idx) => (
                  <li key={idx}>
                    <div className="relative pb-8">
                      {idx !== complaint.statusHistory.length - 1 && (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-100"
                          aria-hidden="true"
                        ></span>
                      )}
                      <div className="relative flex space-x-3">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                            event.status === "new"
                              ? "bg-blue-500"
                              : "bg-gray-400"
                          }`}
                        >
                          {Clock ? (
                            <Clock
                              aria-hidden="true"
                              className="h-4 w-4 text-white"
                            />
                          ) : (
                            <span>🕐</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-500">
                              Status changed to{" "}
                              <span className="font-bold text-gray-900">
                                {event.status}
                              </span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {event.remarks}
                            </p>
                          </div>
                          <div className="text-right text-xs whitespace-nowrap text-gray-500">
                            {new Date(event.changedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ComplaintWorkspace;
