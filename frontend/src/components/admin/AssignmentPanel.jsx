import { useState, useEffect, useCallback } from "react";
import { 
  X, 
  UserPlus, 
  Info, 
  CheckCircle, 
  Loader2, 
  Clock,
  AlertTriangle,
  Settings,
  Target,
  TrendingUp,
  Calendar,
  Bell,
  Zap
} from "lucide-react";
import api from "../../services/api";
import { toast } from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

const AssignmentPanel = ({ complaint, onClose, onAssigned }) => {
  console.log("AssignmentPanel received complaint:", complaint);
  console.log("Complaint type:", typeof complaint);
  console.log("Complaint keys:", complaint ? Object.keys(complaint) : "null");

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState("immediate");
  const [assignmentConfig, setAssignmentConfig] = useState({
    priority: complaint?.priority || "medium",
    dueDate: null,
    slaOverride: false,
    customSLA: 24,
    notifyAssignee: true,
    notifyUser: false,
    escalationRules: true,
    assignmentNotes: "",
    scheduledTime: null,
  });
  const [slaInfo, setSlaInfo] = useState(null);
  const [escalationRules, setEscalationRules] = useState([]);

  const fetchStaffAndConfig = useCallback(async () => {
    if (!complaint) {
      setStaffList([]);
      setLoading(false);
      return;
    }

    try {
      console.log("Fetching staff for category:", complaint.category?._id || "no category");
      
      // Build the API URL - handle case where category might not exist
      const categoryParam = complaint.category?._id ? `category=${complaint.category._id}` : '';
      const orgParam = complaint.organization?._id || complaint.organization 
        ? `organization=${complaint.organization._id || complaint.organization}` 
        : '';
        
      const queryParams = [categoryParam, orgParam].filter(Boolean).join('&');
      const apiUrl = `/admin/staff/available${queryParams ? `?${queryParams}` : ''}`;
      
      console.log("API URL:", apiUrl);
      
      // Fetch available staff - this endpoint exists
      const staffData = await api.get(apiUrl);
      console.log("Staff data received:", staffData.data);
      
      const staffList = staffData.data.data || staffData.data || [];
      setStaffList(staffList);
      
      console.log(`Found ${staffList.length} available staff members`);
      
      // Set default SLA info based on priority (these endpoints don't exist yet)
      const defaultSLA = {
        timeLimit: assignmentConfig.priority === 'critical' ? 4 : 
                   assignmentConfig.priority === 'high' ? 24 : 
                   assignmentConfig.priority === 'medium' ? 72 : 168,
        responseTime: assignmentConfig.priority === 'critical' ? 1 : 
                      assignmentConfig.priority === 'high' ? 4 : 
                      assignmentConfig.priority === 'medium' ? 8 : 24
      };
      setSlaInfo(defaultSLA);
      
      // Set default escalation rules (since endpoint doesn't exist yet)
      const defaultRules = [{
        _id: 'default-rule',
        name: `${assignmentConfig.priority.charAt(0).toUpperCase() + assignmentConfig.priority.slice(1)} Priority Rule`,
        conditions: {
          timeThreshold: defaultSLA.timeLimit,
          responseThreshold: defaultSLA.responseTime
        },
        actions: {
          escalateToSupervisor: true,
          notifyUser: true
        }
      }];
      setEscalationRules(defaultRules);
      
    } catch (err) {
      console.error("Assignment data fetch error:", err);
      
      // Provide specific error messages based on the response
      if (err.response?.status === 401) {
        toast.error("Authentication required. Please login again.");
      } else if (err.response?.status === 403) {
        toast.error("Access denied. Admin privileges required.");
      } else if (err.response?.status === 404) {
        toast.error("Staff endpoint not found. Please contact system administrator.");
      } else if (err.response?.status >= 500) {
        toast.error("Server error while fetching staff. Please try again later.");
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        toast.error("Cannot connect to server. Please check if backend is running.");
      } else {
        toast.error("Failed to load staff data. Please try again.");
      }
      
      // Set empty defaults so UI still works
      setStaffList([]);
      setSlaInfo({
        timeLimit: 24,
        responseTime: 4
      });
      setEscalationRules([]);
    } finally {
      setLoading(false);
    }
  }, [assignmentConfig.priority, complaint]);

  useEffect(() => {
    fetchStaffAndConfig();
  }, [fetchStaffAndConfig]);

  const handlePriorityChange = async (newPriority) => {
    setAssignmentConfig(prev => ({ ...prev, priority: newPriority }));
    
    // Update default SLA info based on priority
    const defaultSLA = {
      timeLimit: newPriority === 'critical' ? 4 : 
                 newPriority === 'high' ? 24 : 
                 newPriority === 'medium' ? 72 : 168,
      responseTime: newPriority === 'critical' ? 1 : 
                    newPriority === 'high' ? 4 : 
                    newPriority === 'medium' ? 8 : 24
    };
    setSlaInfo(defaultSLA);
    
    // Update escalation rules
    const defaultRules = [{
      _id: 'default-rule',
      name: `${newPriority.charAt(0).toUpperCase() + newPriority.slice(1)} Priority Rule`,
      conditions: {
        timeThreshold: defaultSLA.timeLimit,
        responseThreshold: defaultSLA.responseTime
      },
      actions: {
        escalateToSupervisor: true,
        notifyUser: true
      }
    }];
    setEscalationRules(defaultRules);
  };

  const handleAssign = async (staffId, staffInfo) => {
    if (assignmentMode === "scheduled" && !assignmentConfig.scheduledTime) {
      toast.error("Please select a scheduled time");
      return;
    }

    setIsSubmitting(true);
    try {
      const assignmentData = {
        staffId,
        priority: assignmentConfig.priority,
        remarks: assignmentConfig.assignmentNotes || `Assigned via admin panel. Assignment type: ${assignmentMode}`
      };

      console.log("Sending assignment data:", assignmentData);
      
      await api.post(`/admin/complaints/${complaint?._id || complaint?.id}/assign`, assignmentData);
      
      const staffName = staffInfo.firstName && staffInfo.lastName 
        ? `${staffInfo.firstName} ${staffInfo.lastName}`
        : staffInfo.name || 'staff member';
      
      toast.success(
        assignmentMode === "scheduled" 
          ? `Complaint scheduled for assignment to ${staffName}`
          : `Complaint assigned successfully to ${staffName}`
      );
      
      onAssigned();
    } catch (err) {
      console.error("Assignment error:", err);
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.errors?.[0]?.message || 
                          "Assignment failed";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getWorkloadColor = (count, max) => {
    const percentage = (count / max) * 100;
    if (percentage >= 90) return "text-red-600 bg-red-50";
    if (percentage >= 75) return "text-orange-600 bg-orange-50";
    if (percentage >= 50) return "text-yellow-600 bg-yellow-50";
    return "text-green-600 bg-green-50";
  };

  const getPerformanceColor = (rating) => {
    if (rating >= 4.5) return "text-green-600";
    if (rating >= 4.0) return "text-blue-600";
    if (rating >= 3.5) return "text-yellow-600";
    return "text-red-600";
  };

  if (!complaint) {
    console.error("AssignmentPanel: No complaint provided");
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-2xl shadow-2xl">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Invalid Complaint</h2>
            <p className="text-gray-500 mb-4">The complaint data is not available.</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500 rounded-xl">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Assign Complaint</h2>
              <p className="text-sm text-gray-600">ID: {complaint?.complaintId || complaint?._id || 'Unknown ID'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Main Assignment Area */}
          <div className="flex-1 overflow-y-auto">
            {/* Complaint Info & Configuration */}
            <div className="p-6 space-y-6">
              {/* Complaint Summary */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-bold text-blue-900">{complaint?.title || 'Untitled Complaint'}</h3>
                    <p className="text-sm text-blue-700 mt-1">{complaint?.description?.substring(0, 150) || 'No description available'}...</p>
                    <div className="flex items-center space-x-4 mt-3 text-xs text-blue-600">
                      <span>Category: {complaint?.category?.name || 'Unknown'}</span>
                      <span>User: {complaint?.user?.name || 'Unknown User'}</span>
                      <span>Created: {(() => {
                        try {
                          if (!complaint?.createdAt) return 'Unknown date';
                          return formatDistanceToNow(new Date(complaint.createdAt), { addSuffix: true });
                        } catch (error) {
                          console.error('Date format error:', error);
                          return 'Invalid date';
                        }
                      })()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assignment Configuration */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Assignment Mode */}
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-900 flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    Assignment Type
                  </h4>
                  <div className="space-y-2">
                    {[
                      { id: "immediate", label: "Immediate Assignment", icon: Zap, desc: "Assign and notify now" },
                      { id: "scheduled", label: "Scheduled Assignment", icon: Calendar, desc: "Schedule for later" },
                      { id: "queue", label: "Add to Queue", icon: Clock, desc: "Next available staff" },
                    ].map((option) => (
                      <label key={option.id} className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        assignmentMode === option.id 
                          ? "border-blue-500 bg-blue-50" 
                          : "border-gray-200 hover:border-gray-300"
                      }`}>
                        <input
                          type="radio"
                          name="assignmentMode"
                          value={option.id}
                          checked={assignmentMode === option.id}
                          onChange={(e) => setAssignmentMode(e.target.value)}
                          className="sr-only"
                        />
                        <option.icon className="w-4 h-4 mr-3 text-gray-600" />
                        <div>
                          <div className="font-medium text-gray-900">{option.label}</div>
                          <div className="text-xs text-gray-500">{option.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {assignmentMode === "scheduled" && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Schedule Time
                      </label>
                      <input
                        type="datetime-local"
                        value={assignmentConfig.scheduledTime || ""}
                        onChange={(e) => setAssignmentConfig(prev => ({ 
                          ...prev, scheduledTime: e.target.value 
                        }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  )}
                </div>

                {/* Priority & SLA */}
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-900 flex items-center">
                    <Target className="w-4 h-4 mr-2" />
                    Priority & SLA
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority Level
                    </label>
                    <select
                      value={assignmentConfig.priority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                      <option value="critical">Critical Priority</option>
                    </select>
                  </div>

                  {slaInfo && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">SLA Target</span>
                        <Clock className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>Resolution: {slaInfo.timeLimit} hours</div>
                        <div>First Response: {slaInfo.responseTime} hours</div>
                      </div>
                    </div>
                  )}

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={assignmentConfig.slaOverride}
                      onChange={(e) => setAssignmentConfig(prev => ({ 
                        ...prev, slaOverride: e.target.checked 
                      }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Custom SLA Override</span>
                  </label>

                  {assignmentConfig.slaOverride && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom SLA (hours)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="720"
                        value={assignmentConfig.customSLA}
                        onChange={(e) => setAssignmentConfig(prev => ({ 
                          ...prev, customSLA: parseInt(e.target.value) 
                        }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Notification Options */}
              <div>
                <h4 className="font-bold text-gray-900 mb-3 flex items-center">
                  <Bell className="w-4 h-4 mr-2" />
                  Notification Settings
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={assignmentConfig.notifyAssignee}
                      onChange={(e) => setAssignmentConfig(prev => ({ 
                        ...prev, notifyAssignee: e.target.checked 
                      }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Notify Assignee</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={assignmentConfig.notifyUser}
                      onChange={(e) => setAssignmentConfig(prev => ({ 
                        ...prev, notifyUser: e.target.checked 
                      }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Notify User</span>
                  </label>
                </div>
              </div>

              {/* Assignment Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignment Notes (Optional)
                </label>
                <textarea
                  value={assignmentConfig.assignmentNotes}
                  onChange={(e) => setAssignmentConfig(prev => ({ 
                    ...prev, assignmentNotes: e.target.value 
                  }))}
                  placeholder="Special instructions or context for the assigned staff..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500"
                  rows="3"
                />
              </div>

              {/* Staff Selection */}
              <div>
                <h4 className="font-bold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Available Staff ({staffList.length})
                </h4>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="animate-spin text-blue-500 w-8 h-8 mb-4" />
                    <p className="text-gray-500">Loading available staff...</p>
                  </div>
                ) : staffList.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {staffList.map((staff) => (
                      <div
                        key={staff._id}
                        className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 flex-1">
                            {/* Avatar */}
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                              {staff.firstName?.charAt(0) || staff.name?.charAt(0) || 'S'}
                              {staff.lastName?.charAt(0) || (staff.name?.split(' ')[1]?.charAt(0)) || ''}
                            </div>
                            
                            {/* Staff Info */}
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h5 className="font-bold text-gray-900">
                                  {staff.firstName && staff.lastName 
                                    ? `${staff.firstName} ${staff.lastName}`
                                    : staff.name || 'Unknown Staff'
                                  }
                                </h5>
                                {staff.isOnline && (
                                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{staff.email}</p>
                              <div className="flex items-center space-x-4 mt-2 text-xs">
                                <span className="text-gray-500">{staff.department || 'General'}</span>
                                <span className="text-gray-500">•</span>
                                <span className="text-gray-500">{staff.designation || 'Staff'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Performance Metrics */}
                          <div className="text-right mr-4">
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div>
                                <div className={`text-sm font-bold px-2 py-1 rounded ${getWorkloadColor(staff.activeComplaintCount || 0, staff.maxAssignedComplaints || 10)}`}>
                                  {staff.activeComplaintCount || 0}/{staff.maxAssignedComplaints || 10}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">Workload</div>
                              </div>
                              <div>
                                <div className={`text-sm font-bold ${getPerformanceColor(staff.avgRating || 0)}`}>
                                  {(staff.avgRating || 0).toFixed(1)}★
                                </div>
                                <div className="text-xs text-gray-500 mt-1">Rating</div>
                              </div>
                              <div>
                                <div className="text-sm font-bold text-blue-600">
                                  {staff.avgResolutionTime || 0}h
                                </div>
                                <div className="text-xs text-gray-500 mt-1">Avg Time</div>
                              </div>
                            </div>
                          </div>

                          {/* Assign Button */}
                          <button
                            onClick={() => handleAssign(staff._id, staff)}
                            disabled={isSubmitting || (staff.activeComplaintCount || 0) >= (staff.maxAssignedComplaints || 10)}
                            className={`px-6 py-2 rounded-xl font-medium transition-all flex items-center space-x-2 ${
                              (staff.activeComplaintCount || 0) >= (staff.maxAssignedComplaints || 10)
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : isSubmitting
                                ? "bg-gray-100 text-gray-400 cursor-wait"
                                : "bg-blue-500 hover:bg-blue-600 text-white"
                            }`}
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Assigning...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                <span>
                                  {assignmentMode === "scheduled" ? "Schedule" : "Assign"}
                                </span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Specializations */}
                        {staff.specializations && staff.specializations.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {staff.specializations.map((spec, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg"
                              >
                                {spec.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-600">No Available Staff</p>
                    <div className="text-sm text-gray-500 mt-2 space-y-1">
                      <p>This could be because:</p>
                      <ul className="list-disc list-inside text-left max-w-md mx-auto space-y-1">
                        <li>All staff members are at full capacity</li>
                        <li>No staff specialized in <strong>{complaint?.category?.name || 'this category'}</strong></li>
                        <li>All staff members are currently offline</li>
                        <li>No active staff members in the system</li>
                      </ul>
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-left">
                        <p className="text-xs text-blue-700 font-medium">💡 What you can do:</p>
                        <p className="text-xs text-blue-600 mt-1">
                          • Check staff workload limits in Staff Management<br/>
                          • Verify staff specializations for this category<br/>
                          • Ensure staff members are active and online<br/>
                          • Consider creating more staff accounts
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Escalation Rules */}
          {escalationRules.length > 0 && (
            <div className="w-80 bg-gray-50 border-l overflow-y-auto">
              <div className="p-4 border-b bg-white">
                <h3 className="font-bold text-gray-900 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Active Escalation Rules
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {escalationRules.map((rule) => (
                  <div key={rule._id || rule.name} className="p-3 bg-white rounded-lg border">
                    <div className="font-medium text-sm text-gray-900">{rule.name || 'Unnamed Rule'}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Time: {rule.conditions?.timeThreshold || 24}h
                    </div>
                    <div className="text-xs text-gray-600">
                      Response: {rule.conditions?.responseThreshold || 4}h
                    </div>
                    {rule.actions?.escalateToSupervisor && (
                      <div className="text-xs text-orange-600 mt-1">
                        ⚠ Auto-escalate to supervisor
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentPanel;
