import { useState } from "react";
import { Loader2, Send, CheckCircle, Clock } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";

const StatusUpdateForm = ({ complaint, onUpdate }) => {
  const [status, setStatus] = useState(
    complaint.status === "assigned" ? "in-progress" : "resolved",
  );
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (remarks.length < 20)
      return toast.error("Please provide more detailed remarks (min 20 chars)");

    setLoading(true);
    try {
      await api.put(`/staff/complaints/${complaint._id}/status`, {
        status,
        remarks,
      });
      toast.success(
        status === "resolved"
          ? "Complaint marked as resolved"
          : "Status updated",
      );
      setRemarks("");
      onUpdate();
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setStatus("in-progress")}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            status === "in-progress"
              ? "border-primary bg-blue-50"
              : "border-gray-100"
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
              status === "in-progress"
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            <Clock className="w-4 h-4" />
          </div>
          <p className="font-bold text-gray-900">In Progress</p>
          <p className="text-xs text-gray-500">
            I am currently working on this.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatus("resolved")}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            status === "resolved"
              ? "border-green-600 bg-green-50"
              : "border-gray-100"
          }`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
              status === "resolved"
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            <CheckCircle className="w-4 h-4" />
          </div>
          <p className="font-bold text-gray-900">Mark as Resolved</p>
          <p className="text-xs text-gray-500">The issue has been fixed.</p>
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700">
          Internal Remarks / Resolution Details
        </label>
        <textarea
          rows="4"
          className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm text-gray-900 bg-white placeholder-gray-500"
          placeholder={
            status === "resolved"
              ? "Explain how you resolved the issue..."
              : "Current update on progress..."
          }
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          required
        ></textarea>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center ${
          status === "resolved"
            ? "bg-green-600 hover:bg-green-700"
            : "bg-primary hover:bg-blue-600"
        } disabled:opacity-50`}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <Send className="w-4 h-4 mr-2" />
        )}
        {status === "resolved" ? "Confirm Resolution" : "Update Status"}
      </button>
    </form>
  );
};

export default StatusUpdateForm;
