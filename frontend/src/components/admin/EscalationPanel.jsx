import { useState, useEffect } from "react";
import {
  ShieldAlert,
  Clock,
  ArrowRight,
  User,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import api from "../../services/api";
import Loader from "../common/Loader";
import { Link } from "react-router-dom";

const EscalationPanel = () => {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEscalations = async () => {
      try {
        const { data } = await api.get("/admin/complaints/escalated");
        setEscalations(data.data.complaints);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEscalations();
  }, []);

  if (loading) return <Loader text="Investigating escalations..." />;

  return (
    <div className="space-y-6">
      <div className="bg-red-600 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Crisis Management</h1>
          <p className="text-red-100">
            Review tickets that have breached their SLA or been manually
            escalated.
          </p>
          <div className="mt-6 inline-flex items-center space-x-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{escalations.length}</p>
              <p className="text-xs uppercase tracking-widest font-semibold opacity-70">
                Total Flagged
              </p>
            </div>
            <div className="w-px h-10 bg-red-400"></div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {escalations.filter((e) => e.priority === "critical").length}
              </p>
              <p className="text-xs uppercase tracking-widest font-semibold opacity-70">
                Critical Level
              </p>
            </div>
          </div>
        </div>
        <ShieldAlert className="absolute -right-10 -bottom-10 w-64 h-64 text-red-500/30 rotate-12" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {escalations.length > 0 ? (
          escalations.map((esc) => (
            <div
              key={esc._id}
              className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b border-red-50 bg-red-50/30">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-mono font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                    LEVEL {esc.escalationLevel || 1}
                  </span>
                  <Clock className="w-4 h-4 text-red-400" />
                </div>
                <h3 className="font-bold text-gray-900 line-clamp-1">
                  {esc.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  ID: {esc.complaintId}
                </p>
              </div>

              <div className="p-5 flex-1 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Assigned To</span>
                  <span className="font-semibold text-gray-900 flex items-center">
                    <User className="w-3 h-3 mr-1" />{" "}
                    {esc.assignedTo?.name || "Unassigned"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Overdue By</span>
                  <span className="font-bold text-red-600">SLA BREACH</span>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t flex space-x-2">
                <Link
                  to={`/complaints/${esc._id}`}
                  className="flex-1 py-2 text-center bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Inspect
                </Link>
                <Link
                  to="/admin/complaints"
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-100"
                >
                  Reassign
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-gray-300">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900">
              Zero Escalations
            </h3>
            <p className="text-gray-500">
              System is performing within SLA parameters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EscalationPanel;
