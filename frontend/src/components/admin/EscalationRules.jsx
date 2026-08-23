import { useState, useEffect } from "react";
import {
  Settings,
  Clock,
  AlertTriangle,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Info,
} from "lucide-react";
import api from "../../services/api";
import { toast } from "react-hot-toast";

const EscalationRules = () => {
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    priority: "",
    conditions: {
      timeThreshold: 24, // hours
      responseThreshold: 72, // hours
      noUpdateThreshold: 48, // hours
    },
    actions: {
      escalateToSupervisor: true,
      increasePriority: false,
      sendNotification: true,
      autoAssign: false,
    },
    isActive: true,
  });

  useEffect(() => {
    fetchRules();
    fetchCategories();
  }, []);

  const fetchRules = async () => {
    try {
      const { data } = await api.get("/admin/escalation-rules");
      setRules(data.data);
    } catch (err) {
      toast.error("Failed to fetch escalation rules");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get("/admin/categories");
      setCategories(data.data);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRule) {
        await api.put(`/admin/escalation-rules/${editingRule._id}`, formData);
        toast.success("Escalation rule updated successfully");
      } else {
        await api.post("/admin/escalation-rules", formData);
        toast.success("Escalation rule created successfully");
      }
      setIsModalOpen(false);
      setEditingRule(null);
      resetForm();
      fetchRules();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save rule");
    }
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      category: rule.category?._id || "",
      priority: rule.priority,
      conditions: rule.conditions,
      actions: rule.actions,
      isActive: rule.isActive,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (ruleId) => {
    if (!confirm("Are you sure you want to delete this escalation rule?")) return;
    
    try {
      await api.delete(`/admin/escalation-rules/${ruleId}`);
      toast.success("Escalation rule deleted successfully");
      fetchRules();
    } catch (err) {
      toast.error("Failed to delete escalation rule");
    }
  };

  const toggleRuleStatus = async (ruleId, isActive) => {
    try {
      await api.patch(`/admin/escalation-rules/${ruleId}/toggle`, { isActive });
      toast.success(`Rule ${isActive ? "activated" : "deactivated"}`);
      fetchRules();
    } catch (err) {
      toast.error("Failed to update rule status");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      priority: "",
      conditions: {
        timeThreshold: 24,
        responseThreshold: 72,
        noUpdateThreshold: 48,
      },
      actions: {
        escalateToSupervisor: true,
        increasePriority: false,
        sendNotification: true,
        autoAssign: false,
      },
      isActive: true,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setEditingRule(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Escalation Rules</h1>
            <p className="text-orange-100">
              Configure automatic escalation conditions based on SLA
            </p>
          </div>
          <Settings className="w-12 h-12 text-orange-200" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{rules.length}</span> rules configured
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium text-green-600">
              {rules.filter(r => r.isActive).length}
            </span>{" "}
            active
          </div>
        </div>
        
        <button
          onClick={openCreateModal}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Rule</span>
        </button>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Clock className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-600">No escalation rules configured</p>
            <p className="text-sm text-gray-500 mb-4">
              Create your first rule to automate escalation based on SLA conditions
            </p>
            <button
              onClick={openCreateModal}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl font-medium transition-colors"
            >
              Create First Rule
            </button>
          </div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule._id}
              className={`bg-white border rounded-2xl p-6 transition-all duration-200 hover:shadow-md ${
                rule.isActive ? "border-green-200" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-lg font-bold text-gray-900">
                      {rule.name}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        rule.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {rule.isActive ? "Active" : "Inactive"}
                    </span>
                    {rule.category && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {rule.category.name}
                      </span>
                    )}
                    {rule.priority && (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          rule.priority === "high"
                            ? "bg-red-100 text-red-700"
                            : rule.priority === "medium"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {rule.priority.charAt(0).toUpperCase() + rule.priority.slice(1)} Priority
                      </span>
                    )}
                  </div>

                  {/* Conditions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Time Threshold
                      </div>
                      <div className="text-sm font-bold text-gray-900">
                        {rule.conditions.timeThreshold}h
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Response Threshold
                      </div>
                      <div className="text-sm font-bold text-gray-900">
                        {rule.conditions.responseThreshold}h
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        No Update Threshold
                      </div>
                      <div className="text-sm font-bold text-gray-900">
                        {rule.conditions.noUpdateThreshold}h
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {rule.actions.escalateToSupervisor && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-lg">
                        Escalate to Supervisor
                      </span>
                    )}
                    {rule.actions.increasePriority && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-lg">
                        Increase Priority
                      </span>
                    )}
                    {rule.actions.sendNotification && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg">
                        Send Notification
                      </span>
                    )}
                    {rule.actions.autoAssign && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg">
                        Auto-assign
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => toggleRuleStatus(rule._id, !rule.isActive)}
                    className={`p-2 rounded-xl transition-colors ${
                      rule.isActive
                        ? "bg-red-100 hover:bg-red-200 text-red-600"
                        : "bg-green-100 hover:bg-green-200 text-green-600"
                    }`}
                    title={rule.isActive ? "Deactivate rule" : "Activate rule"}
                  >
                    {rule.isActive ? <X className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleEdit(rule)}
                    className="p-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
                    title="Edit rule"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule._id)}
                    className="p-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
                    title="Delete rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b bg-gray-50 sticky top-0">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">
                  {editingRule ? "Edit Escalation Rule" : "Create New Escalation Rule"}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 hover:bg-gray-200 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rule Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500"
                    placeholder="e.g., High Priority SLA Rule"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category (Optional)
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                    >
                      <option value="" className="text-gray-500">All Categories</option>
                      {categories.map(category => (
                        <option key={category._id} value={category._id} className="text-gray-900">
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority Level
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                      required
                    >
                      <option value="" className="text-gray-500">Select Priority</option>
                      <option value="low" className="text-gray-900">Low Priority</option>
                      <option value="medium" className="text-gray-900">Medium Priority</option>
                      <option value="high" className="text-gray-900">High Priority</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Conditions */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Escalation Conditions</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time Threshold (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.conditions.timeThreshold}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        conditions: { ...prev.conditions, timeThreshold: parseInt(e.target.value) }
                      }))}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Response Threshold (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.conditions.responseThreshold}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        conditions: { ...prev.conditions, responseThreshold: parseInt(e.target.value) }
                      }))}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      No Update Threshold (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.conditions.noUpdateThreshold}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        conditions: { ...prev.conditions, noUpdateThreshold: parseInt(e.target.value) }
                      }))}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Escalation Actions</h3>
                <div className="space-y-3">
                  {[
                    { key: "escalateToSupervisor", label: "Escalate to Supervisor" },
                    { key: "increasePriority", label: "Increase Priority Level" },
                    { key: "sendNotification", label: "Send Notification" },
                    { key: "autoAssign", label: "Auto-assign to Available Staff" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                      <input
                        type="checkbox"
                        checked={formData.actions[key]}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          actions: { ...prev.actions, [key]: e.target.checked }
                        }))}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Activate this rule immediately
                  </span>
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingRule ? "Update Rule" : "Create Rule"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EscalationRules;