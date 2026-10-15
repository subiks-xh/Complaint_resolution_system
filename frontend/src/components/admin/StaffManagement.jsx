import { useState, useEffect } from "react";
import {
  UserPlus,
  Shield,
  Mail,
  MoreVertical,
  CheckCircle,
  XCircle,
  X,
  User,
  Phone,
  Building,
  Lock,
  TrendingUp,
  Award,
  Clock,
  Target,
  Edit,
  Star,
  MessageSquare,
  ThumbsUp,
  Eye,
  Plus,
  Filter,
} from "lucide-react";
import api from "../../services/api";
import Loader from "../common/Loader";
import { toast } from "react-hot-toast";

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAddFeedbackModal, setShowAddFeedbackModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffFeedback, setStaffFeedback] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key for dynamic updates
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
    password: "",
    maxAssignedComplaints: 10,
    specializations: [],
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    phone: "",
    department: "",
    designation: "",
    maxAssignedComplaints: 10,
    specializations: [],
  });
  const [feedbackFormData, setFeedbackFormData] = useState({
    rating: 5,
    comment: "",
    category: "general",
    isAnonymous: false
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/admin/staff");
      console.log("Staff data fetched:", data.data.staff);
      setStaff(data.data.staff);
    } catch (err) {
      console.error("Fetch staff error:", err);
      toast.error("Failed to load staff members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    // Fetch categories for specializations
    const fetchCategories = async () => {
      try {
        const { data } = await api.get("/categories");
        setCategories(data.data);
      } catch (err) {
        console.error("Fetch categories error:", err);
      }
    };
    fetchCategories();
  }, [refreshKey]); // Re-fetch when refreshKey changes

  // Update form when selectedStaff changes
  useEffect(() => {
    if (selectedStaff && showEditModal) {
      setEditFormData({
        name: selectedStaff.name || "",
        phone: selectedStaff.phone || "",
        department: selectedStaff.department || "",
        designation: selectedStaff.designation || "",
        maxAssignedComplaints: selectedStaff.maxAssignedComplaints || 10,
        specializations: selectedStaff.specializations?.map(s => s._id || s) || [],
      });
    }
  }, [selectedStaff, showEditModal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post("/auth/register-staff", formData);
      toast.success("Staff member added successfully!");
      setShowModal(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        department: "",
        designation: "",
        password: "",
        maxAssignedComplaints: 10,
        specializations: [],
      });
      setRefreshKey((prev) => prev + 1); // Trigger refresh
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add staff member");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleCategoryToggle = (categoryId, isEdit = false) => {
    if (isEdit) {
      setEditFormData((prev) => ({
        ...prev,
        specializations: prev.specializations.includes(categoryId)
          ? prev.specializations.filter((id) => id !== categoryId)
          : [...prev.specializations, categoryId],
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        specializations: prev.specializations.includes(categoryId)
          ? prev.specializations.filter((id) => id !== categoryId)
          : [...prev.specializations, categoryId],
      }));
    }
  };

  const viewPerformance = async (staffMember) => {
    setSelectedStaff(staffMember);
    setShowPerformance(true);
    setPerformanceData(null); // Reset to show loading state
    try {
      const { data } = await api.get(`/admin/staff/${staffMember._id}/performance`);
      console.log("Performance API Response:", data.data);
      // Map the backend response to the format expected by the UI
      const perfData = data.data.performance;
      setPerformanceData({
        totalComplaints: perfData.complaints.total,
        resolved: perfData.complaints.resolved,
        activeCases: perfData.complaints.pending,
        averageRating: perfData.feedback.averageRating || 0,
        avgResolutionTime: perfData.resolutionTime.avgResolutionTime || 0,
        slaCompliance: perfData.complaints.slaComplianceRate,
        escalations: perfData.complaints.escalated,
        reopened: 0, // Not in current API response
        feedbackCount: perfData.feedback.totalFeedbacks || 0,
      });
    } catch (err) {
      console.error("Performance fetch error:", err);
      toast.error("Failed to load performance data");
      setPerformanceData(null);
    }
  };

  const openEditModal = (staffMember) => {
    setSelectedStaff(staffMember);
    // Pre-populate form with existing data
    const formValues = {
      name: staffMember.name || "",
      phone: staffMember.phone || "",
      department: staffMember.department || "",
      designation: staffMember.designation || "",
      maxAssignedComplaints: staffMember.maxAssignedComplaints || 10,
    };
    console.log("Opening edit modal with data:", formValues);
    console.log("Staff member:", staffMember);
    setEditFormData(formValues);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Update staff specializations using admin endpoint
      await api.put(`/admin/staff/${selectedStaff._id}/specializations`, {
        specializations: editFormData.specializations,
        maxAssignedComplaints: editFormData.maxAssignedComplaints,
      });
      
      // Update other staff details using user endpoint
      await api.put(`/users/${selectedStaff._id}`, {
        firstName: editFormData.name?.split(' ')[0] || editFormData.name,
        lastName: editFormData.name?.split(' ').slice(1).join(' ') || '',
        phone: editFormData.phone,
        department: editFormData.department,
        designation: editFormData.designation,
      });
      
      toast.success("Staff member updated successfully!");
      setShowEditModal(false);
      setRefreshKey((prev) => prev + 1); // Trigger refresh
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update staff member");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await api.put(`/admin/staff/${id}/status`, { isActive: !currentStatus });
      toast.success("Staff status updated");
      setRefreshKey((prev) => prev + 1); // Trigger refresh
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  // Feedback Management Functions
  const viewStaffFeedback = async (staffMember) => {
    setSelectedStaff(staffMember);
    setFeedbackLoading(true);
    setShowFeedbackModal(true);
    
    try {
      const { data } = await api.get(`/admin/staff/${staffMember._id}/feedback`);
      setStaffFeedback(data.data || []);
    } catch (err) {
      console.error("Fetch feedback error:", err);
      toast.error("Failed to load feedback data");
      setStaffFeedback([]);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const addFeedback = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post(`/admin/staff/${selectedStaff._id}/feedback`, {
        ...feedbackFormData,
        feedbackType: 'admin'
      });
      
      toast.success("Feedback added successfully!");
      setShowAddFeedbackModal(false);
      setFeedbackFormData({
        rating: 5,
        comment: "",
        category: "general",
        isAnonymous: false
      });
      
      // Refresh feedback list if modal is open
      if (showFeedbackModal) {
        viewStaffFeedback(selectedStaff);
      }
      
      setRefreshKey((prev) => prev + 1); // Trigger refresh
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedbackChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFeedbackFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const getFeedbackStats = (feedback) => {
    if (!feedback || feedback.length === 0) {
      return { average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    }

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let total = 0;

    feedback.forEach(f => {
      const rating = f.rating || 0;
      if (rating >= 1 && rating <= 5) {
        distribution[rating]++;
        total += rating;
      }
    });

    return {
      average: feedback.length > 0 ? (total / feedback.length).toFixed(1) : 0,
      count: feedback.length,
      distribution
    };
  };

  const getRatingColor = (rating) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 3.5) return 'text-blue-600';
    if (rating >= 2.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderStarRating = (rating, interactive = false, onChange = null) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type={interactive ? "button" : undefined}
          onClick={interactive ? () => onChange && onChange(i) : undefined}
          className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-all`}
          disabled={!interactive}
        >
          <Star 
            className={`w-4 h-4 ${
              i <= rating 
                ? 'text-yellow-400 fill-yellow-400' 
                : 'text-gray-300'
            }`}
          />
        </button>
      );
    }
    return <div className="flex gap-1">{stars}</div>;
  };

  if (loading) return <Loader text="Managing personnel..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg font-bold flex items-center hover:bg-blue-600 transition-colors"
        >
          <UserPlus className="w-4 h-4 mr-2" /> Add Staff Member
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map((member) => (
          <div
            key={member._id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-primary flex items-center justify-center font-bold text-lg border border-blue-100">
                  {member.name.charAt(0)}
                </div>
                <button
                  onClick={() => toggleStatus(member._id, member.isActive)}
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                    member.isActive
                      ? "text-green-600 bg-green-50"
                      : "text-red-600 bg-red-50"
                  }`}
                >
                  {member.isActive ? "Active" : "Inactive"}
                </button>
              </div>
              <h3 className="font-bold text-gray-900">{member.name}</h3>
              <p className="text-sm text-gray-500 flex items-center mt-1">
                <Mail className="w-3 h-3 mr-1" /> {member.email}
              </p>
              {member.organization ? (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <Building className="w-3 h-3" />
                  <span>{member.organization.name || "Assigned Org"}</span>
                </div>
              ) : (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                  <Building className="w-3 h-3" />
                  <span>Unassigned Organization</span>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-50">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Current Workload</span>
                  <span className="font-bold text-gray-900">
                    {member.statistics?.complaints?.assigned || 0} tasks
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-2">
                  <span className="text-gray-500">Avg. Rating</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${getRatingColor(member.statistics?.feedback?.averageRating || 0)}`}>
                      {(member.statistics?.feedback?.averageRating || 0).toFixed(1)}/5.0
                    </span>
                    {renderStarRating(Math.round(member.statistics?.feedback?.averageRating || 0))}
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm mt-2">
                  <span className="text-gray-500">Total Feedback</span>
                  <span className="font-bold text-blue-600">
                    {member.statistics?.feedback?.totalCount || 0} reviews
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 border-t border-gray-100">
              <div className="px-6 py-3 flex justify-between items-center">
                <div className="flex gap-3">
                  <button
                    onClick={() => viewStaffFeedback(member)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    View Feedback
                  </button>
                  <button
                    onClick={() => {
                      setSelectedStaff(member);
                      setShowAddFeedbackModal(true);
                    }}
                    className="text-xs font-bold text-green-600 hover:text-green-800 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Feedback
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => viewPerformance(member)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Performance
                  </button>
                  <button
                    onClick={() => openEditModal(member)}
                    className="text-xs font-bold text-gray-400 hover:text-gray-600"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                Add Staff Member
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-gray-900"
                      placeholder="Jane Wilson"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-gray-900"
                      placeholder="jane.wilson@techflow.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-gray-900"
                      placeholder="5559876543"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department *
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none appearance-none bg-white text-gray-900"
                    >
                      <option value="">Select Department</option>
                      <option value="IT Support">IT Support</option>
                      <option value="HR">Human Resources</option>
                      <option value="Finance">Finance</option>
                      <option value="Operations">Operations</option>
                      <option value="Customer Service">Customer Service</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-gray-900"
                    placeholder="Senior Support Engineer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Assigned Complaints
                  </label>
                  <input
                    type="number"
                    name="maxAssignedComplaints"
                    value={formData.maxAssignedComplaints}
                    onChange={handleChange}
                    min="1"
                    max="50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-gray-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength="8"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-gray-900"
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Staff member will use this password to login
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specializations (Categories)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {categories.map((cat) => (
                      <div
                        key={cat._id}
                        onClick={() => handleCategoryToggle(cat._id, false)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          formData.specializations.includes(cat._id)
                            ? "border-primary bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-sm font-medium text-gray-900">
                            {cat.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Select categories this staff member can handle
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Adding..." : "Add Staff Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Performance Modal */}
      {showPerformance && selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Performance Report
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedStaff.name} • {selectedStaff.department || "No Department"} • {selectedStaff.organization?.name || "Unassigned Organization"}
                </p>
              </div>
              <button
                onClick={() => setShowPerformance(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {!performanceData ? (
                <div className="flex items-center justify-center py-12">
                  <Loader text="Loading performance data..." />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <div className="flex items-center justify-between mb-2">
                        <Target className="w-5 h-5 text-blue-600" />
                        <span className="text-xs font-medium text-blue-600">
                          Total
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {performanceData.totalComplaints || 0}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Complaints Handled
                      </p>
                    </div>

                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <div className="flex items-center justify-between mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-xs font-medium text-green-600">
                          Resolved
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {performanceData.resolved || 0}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Success Rate:{" "}
                        {performanceData.totalComplaints
                          ? Math.round(
                              (performanceData.resolved /
                                performanceData.totalComplaints) *
                                100
                            )
                          : 0}
                        %
                      </p>
                    </div>

                    <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                      <div className="flex items-center justify-between mb-2">
                        <Award className="w-5 h-5 text-purple-600" />
                        <span className="text-xs font-medium text-purple-600">
                          Rating
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {performanceData.averageRating?.toFixed(1) || "0.0"}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Average Feedback
                      </p>
                    </div>

                    <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                      <div className="flex items-center justify-between mb-2">
                        <Clock className="w-5 h-5 text-orange-600" />
                        <span className="text-xs font-medium text-orange-600">
                          Response
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {performanceData.avgResolutionTime?.toFixed(1) || "0"}h
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Avg. Resolution Time
                      </p>
                    </div>
                  </div>

                  {/* Additional Stats */}
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <h3 className="font-bold text-gray-900 mb-4">
                      Detailed Statistics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Active Cases</p>
                        <p className="text-lg font-bold text-gray-900">
                          {performanceData.activeCases || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">SLA Compliance</p>
                        <p className="text-lg font-bold text-green-600">
                          {performanceData.slaCompliance || 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Escalations</p>
                        <p className="text-lg font-bold text-red-600">
                          {performanceData.escalations || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Reopened</p>
                        <p className="text-lg font-bold text-orange-600">
                          {performanceData.reopened || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Capacity</p>
                        <p className="text-lg font-bold text-blue-600">
                          {performanceData.activeCases || 0}/
                          {selectedStaff.maxAssignedComplaints || 10}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Feedback Count</p>
                        <p className="text-lg font-bold text-purple-600">
                          {performanceData.feedbackCount || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                Edit Staff Member
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditChange}
                      required
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={selectedStaff.email}
                      disabled
                      className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      name="phone"
                      value={editFormData.phone}
                      onChange={handleEditChange}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      name="department"
                      value={editFormData.department}
                      onChange={handleEditChange}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none appearance-none bg-white text-gray-900"
                    >
                      <option value="">Select Department</option>
                      <option value="IT Support">IT Support</option>
                      <option value="HR">Human Resources</option>
                      <option value="Finance">Finance</option>
                      <option value="Operations">Operations</option>
                      <option value="Customer Service">Customer Service</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    name="designation"
                    value={editFormData.designation}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Assigned Complaints
                  </label>
                  <input
                    type="number"
                    name="maxAssignedComplaints"
                    value={editFormData.maxAssignedComplaints}
                    onChange={handleEditChange}
                    min="1"
                    max="50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-gray-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specializations (Categories)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {categories.map((cat) => (
                      <div
                        key={cat._id}
                        onClick={() => handleCategoryToggle(cat._id, true)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          editFormData.specializations.includes(cat._id)
                            ? "border-primary bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-sm font-medium text-gray-900">
                            {cat.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Select categories this staff member can handle
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Updating..." : "Update Staff Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Feedback Modal */}
      {showFeedbackModal && selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Feedback for {selectedStaff.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {(selectedStaff.statistics?.feedback?.averageRating || 0).toFixed(1)}/5.0 average rating • 
                  {selectedStaff.statistics?.feedback?.totalCount || 0} total reviews • {selectedStaff.organization?.name || "Unassigned Organization"}
                </p>
              </div>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {feedbackLoading ? (
                <div className="text-center py-8">
                  <Loader text="Loading feedback..." />
                </div>
              ) : staffFeedback.length > 0 ? (
                <div className="space-y-6">
                  {/* Feedback Summary */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Feedback Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {[5, 4, 3, 2, 1].map(rating => {
                        const stats = getFeedbackStats(staffFeedback);
                        const count = stats.distribution[rating] || 0;
                        const percentage = stats.count > 0 ? ((count / stats.count) * 100).toFixed(0) : 0;
                        
                        return (
                          <div key={rating} className="text-center">
                            <div className="flex items-center justify-center gap-1 mb-2">
                              <span className="text-sm font-medium">{rating}</span>
                              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            </div>
                            <div className="text-2xl font-bold text-gray-900">{count}</div>
                            <div className="text-xs text-gray-500">{percentage}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Feedback List */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-gray-900">Recent Feedback</h3>
                      <button
                        onClick={() => setShowAddFeedbackModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Feedback
                      </button>
                    </div>
                    
                    {staffFeedback.map((feedback) => (
                      <div key={feedback._id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              {feedback.isAnonymous ? (
                                <User className="w-5 h-5 text-blue-600" />
                              ) : (
                                <span className="font-bold text-blue-600">
                                  {feedback.givenBy?.name?.charAt(0) || 'U'}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {feedback.isAnonymous ? 'Anonymous' : feedback.givenBy?.name || 'Unknown User'}
                              </p>
                              <div className="flex items-center gap-2">
                                {renderStarRating(feedback.rating)}
                                <span className="text-sm text-gray-500">
                                  {new Date(feedback.createdAt).toLocaleDateString()}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  feedback.feedbackType === 'admin' 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {feedback.feedbackType === 'admin' ? 'Admin' : 'User'} Feedback
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 capitalize">
                            {feedback.category}
                          </span>
                        </div>
                        
                        {feedback.comment && (
                          <p className="text-gray-700 text-sm leading-relaxed ml-13">
                            "{feedback.comment}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No feedback yet</h3>
                  <p className="text-gray-500 mb-4">Be the first to provide feedback for this staff member.</p>
                  <button
                    onClick={() => setShowAddFeedbackModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mx-auto"
                  >
                    <Plus className="w-4 h-4" />
                    Add First Feedback
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Feedback Modal */}
      {showAddFeedbackModal && selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                Add Feedback for {selectedStaff.name}
              </h2>
              <button
                onClick={() => setShowAddFeedbackModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={addFeedback} className="p-6 space-y-6">
              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Overall Rating *
                </label>
                <div className="flex items-center gap-4">
                  {renderStarRating(feedbackFormData.rating, true, (rating) => {
                    setFeedbackFormData(prev => ({ ...prev, rating }));
                  })}
                  <span className="text-lg font-bold text-gray-900">
                    {feedbackFormData.rating}/5
                  </span>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Feedback Category *
                </label>
                <select
                  name="category"
                  value={feedbackFormData.category}
                  onChange={handleFeedbackChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                >
                  <option value="general">General Performance</option>
                  <option value="communication">Communication Skills</option>
                  <option value="technical">Technical Expertise</option>
                  <option value="timeliness">Response Timeliness</option>
                  <option value="problem_solving">Problem Solving</option>
                  <option value="attitude">Professional Attitude</option>
                </select>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Detailed Comments
                </label>
                <textarea
                  name="comment"
                  value={feedbackFormData.comment}
                  onChange={handleFeedbackChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-gray-900"
                  placeholder="Share your experience working with this staff member..."
                />
              </div>

              {/* Anonymous Option */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isAnonymous"
                  name="isAnonymous"
                  checked={feedbackFormData.isAnonymous}
                  onChange={handleFeedbackChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isAnonymous" className="text-sm text-gray-700">
                  Submit as anonymous feedback
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddFeedbackModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
