import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import api from "../../services/api";
import Loader from "../common/Loader";

const ComplaintList = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const { data } = await api.get("/complaints/my-complaints");
        setComplaints(data.data.complaints);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  const getStatusBadge = (status) => {
    const styles = {
      new: "bg-blue-100 text-blue-700",
      assigned: "bg-purple-100 text-purple-700",
      "in-progress": "bg-amber-100 text-amber-700",
      resolved: "bg-green-100 text-green-700",
      escalated: "bg-red-100 text-red-700",
      closed: "bg-gray-100 text-gray-700",
    };
    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status]}`}
      >
        {status}
      </span>
    );
  };

  const filteredComplaints =
    filter === "all"
      ? complaints
      : complaints.filter((c) => c.status === filter);

  if (loading) return <Loader text="Fetching your complaints..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">My Complaints</h1>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search ID or title..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 w-full md:w-64 text-gray-900 bg-white placeholder-gray-500"
            />
          </div>
          <select
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 text-gray-900 bg-white"
          >
            <option value="all" className="text-gray-900">All Status</option>
            <option value="new" className="text-gray-900">New</option>
            <option value="in-progress" className="text-gray-900">In Progress</option>
            <option value="resolved" className="text-gray-900">Resolved</option>
            <option value="escalated" className="text-gray-900">Escalated</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredComplaints.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredComplaints.map((item) => (
              <Link
                key={item._id}
                to={`/complaints/${item._id}`}
                className="block hover:bg-gray-50 transition-colors p-4 md:p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center space-x-3 mb-1">
                      <span className="text-xs font-mono font-bold text-primary">
                        {item.complaintId}
                      </span>
                      {getStatusBadge(item.status)}
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          item.priority === "high"
                            ? "text-red-600 bg-red-50"
                            : "text-gray-500 bg-gray-50"
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {item.title}
                    </h3>
                    <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />{" "}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                      <span className="hidden md:block truncate">
                        Category: {item.category?.name}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 text-gray-400 mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              No complaints found
            </h3>
            <p className="text-gray-500 mt-1">
              Looks like everything is running smoothly.
            </p>
            <Link
              to="/complaints/new"
              className="mt-6 inline-flex items-center text-primary font-semibold hover:underline"
            >
              Submit a new complaint
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplaintList;
