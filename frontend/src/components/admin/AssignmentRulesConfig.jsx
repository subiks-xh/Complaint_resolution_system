import { useState, useEffect } from "react";
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Settings, 
  Save,
  X,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  Target,
  BarChart3,
  Filter,
  Activity,
  MapPin,
  Zap
} from "lucide-react";
import api from "../../services/api";
import { toast } from "react-hot-toast";

const AssignmentRulesConfig = () => {
  const [rules, setRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    conditions: {
      categories: [],
      priorities: [],
      workingHours: {
        enabled: false,
        start: "09:00",
        end: "17:00",
        timezone: "UTC"
      },
      maxWorkload: {
        enabled: true,
        percentage: 80
      },
      skillMatching: {
        enabled: true,
        strictMode: false
      },
      geographicProximity: {
        enabled: false,
        maxDistance: 50
      }
    },
    actions: {
      assignmentMethod: "least_loaded",
      autoAssign: false,
      notificationSettings: {
        assigneeNotification: true,
        userNotification: false,
        supervisorNotification: false,
        escalationNotification: true
      },
      slaSettings: {
        useCustomSLA: false,
        customSLAHours: 24,
        responseTimeHours: 4,
        escalationEnabled: true
      },
      scheduling: {
        allowScheduledAssignment: true,
        maxScheduleHours: 72
      }
    },
    isActive: true,
    priority: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rulesData, categoriesData, analyticsData] = await Promise.all([
        api.get('/admin/assignment-rules'),
        api.get('/categories'),
        api.get('/admin/assignment-analytics')
      ]);
      
      setRules(rulesData.data.data.rules || []);
      setCategories(categoriesData.data.data || []);
      setAnalytics(analyticsData.data.data || {});
    } catch (error) {
      toast.error('Failed to load assignment configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingRule) {
        await api.put(`/admin/assignment-rules/${editingRule._id}`, formData);
        toast.success('Assignment rule updated successfully');
      } else {
        await api.post('/admin/assignment-rules', formData);
        toast.success('Assignment rule created successfully');
      }
      
      setShowModal(false);
      setEditingRule(null);
      fetchData();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save assignment rule');
    }
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({ ...rule });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this assignment rule?')) return;
    
    try {
      await api.delete(`/admin/assignment-rules/${id}`);
      toast.success('Assignment rule deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete assignment rule');
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      conditions: {
        categories: [],
        priorities: [],
        workingHours: { enabled: false, start: "09:00", end: "17:00", timezone: "UTC" },
        maxWorkload: { enabled: true, percentage: 80 },
        skillMatching: { enabled: true, strictMode: false },
        geographicProximity: { enabled: false, maxDistance: 50 }
      },
      actions: {
        assignmentMethod: "least_loaded",
        autoAssign: false,
        notificationSettings: {
          assigneeNotification: true,
          userNotification: false,
          supervisorNotification: false,
          escalationNotification: true
        },
        slaSettings: {
          useCustomSLA: false,
          customSLAHours: 24,
          responseTimeHours: 4,
          escalationEnabled: true
        },
        scheduling: {
          allowScheduledAssignment: true,
          maxScheduleHours: 72
        }
      },
      isActive: true,
      priority: 0
    });
  };

  const updateFormData = (path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const assignmentMethods = [
    { value: 'round_robin', label: 'Round Robin', desc: 'Assign in rotating order', icon: Activity },
    { value: 'least_loaded', label: 'Least Loaded', desc: 'Assign to staff with lowest workload', icon: BarChart3 },
    { value: 'skill_based', label: 'Skill Based', desc: 'Match by specialization', icon: Target },
    { value: 'geographic', label: 'Geographic', desc: 'Assign by location proximity', icon: MapPin },
    { value: 'performance_based', label: 'Performance Based', desc: 'Assign to best performers', icon: Zap }
  ];

  const priorityLevels = [
    { value: 'low', label: 'Low', color: 'text-green-600' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
    { value: 'high', label: 'High', color: 'text-orange-600' },
    { value: 'critical', label: 'Critical', color: 'text-red-600' }
  ];

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading assignment configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Assignment Rules Configuration</h2>
          <p className="text-gray-600 mt-1">Configure automated assignment logic and rules</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Rule</span>
        </button>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Rules</p>
                <p className="text-2xl font-bold text-gray-900">{rules.filter(r => r.isActive).length}</p>
              </div>
              <Settings className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Auto Assignments</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.autoAssignments || 0}</p>
              </div>
              <Zap className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">SLA Compliance</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.slaCompliance || 0}%</p>
              </div>
              <Clock className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Response</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.avgResponseTime || 0}h</p>
              </div>
              <Activity className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="bg-white rounded-xl border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold text-gray-900">Assignment Rules</h3>
        </div>
        
        <div className="divide-y">
          {rules.length > 0 ? (
            rules.map((rule) => (
              <div key={rule._id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-lg font-bold text-gray-900">{rule.name}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        rule.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                        Priority: {rule.priority}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                    
                    <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                      <span>Method: {assignmentMethods.find(m => m.value === rule.actions.assignmentMethod)?.label}</span>
                      <span>•</span>
                      <span>Categories: {rule.conditions.categories?.length || 'All'}</span>
                      <span>•</span>
                      <span>Auto-assign: {rule.actions.autoAssign ? 'Yes' : 'No'}</span>
                      <span>•</span>
                      <span>Used: {rule.usage?.totalAssignments || 0} times</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule._id)}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-600">No Assignment Rules</h4>
              <p className="text-gray-500 mt-1">Create your first assignment rule to automate complaint assignments</p>
            </div>
          )}
        </div>
      </div>

      {/* Assignment Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRule ? 'Edit Assignment Rule' : 'Create Assignment Rule'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingRule(null);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rule Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => updateFormData('name', e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., High Priority Auto Assignment"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority (Higher = Applied First)
                      </label>
                      <input
                        type="number"
                        value={formData.priority}
                        onChange={(e) => updateFormData('priority', parseInt(e.target.value))}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => updateFormData('description', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows="3"
                      placeholder="Describe when and how this rule should be applied"
                    />
                  </div>
                </div>

                {/* Conditions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Rule Conditions</h3>
                  
                  {/* Categories */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Apply to Categories (Leave empty for all)
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {categories.map((category) => (
                        <label key={category._id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.conditions.categories.includes(category._id)}
                            onChange={(e) => {
                              const newCategories = e.target.checked
                                ? [...formData.conditions.categories, category._id]
                                : formData.conditions.categories.filter(id => id !== category._id);
                              updateFormData('conditions.categories', newCategories);
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{category.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Priorities */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Apply to Priority Levels (Leave empty for all)
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {priorityLevels.map((priority) => (
                        <label key={priority.value} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.conditions.priorities.includes(priority.value)}
                            onChange={(e) => {
                              const newPriorities = e.target.checked
                                ? [...formData.conditions.priorities, priority.value]
                                : formData.conditions.priorities.filter(p => p !== priority.value);
                              updateFormData('conditions.priorities', newPriorities);
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className={`text-sm ${priority.color}`}>{priority.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Working Hours */}
                  <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.conditions.workingHours.enabled}
                        onChange={(e) => updateFormData('conditions.workingHours.enabled', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">Apply only during working hours</span>
                    </label>
                    
                    {formData.conditions.workingHours.enabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                          <input
                            type="time"
                            value={formData.conditions.workingHours.start}
                            onChange={(e) => updateFormData('conditions.workingHours.start', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                          <input
                            type="time"
                            value={formData.conditions.workingHours.end}
                            onChange={(e) => updateFormData('conditions.workingHours.end', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Skill Matching */}
                  <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.conditions.skillMatching.enabled}
                        onChange={(e) => updateFormData('conditions.skillMatching.enabled', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">Enable skill matching</span>
                    </label>
                    
                    {formData.conditions.skillMatching.enabled && (
                      <label className="flex items-center space-x-2 ml-6">
                        <input
                          type="checkbox"
                          checked={formData.conditions.skillMatching.strictMode}
                          onChange={(e) => updateFormData('conditions.skillMatching.strictMode', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Strict mode (require exact specialization match)</span>
                      </label>
                    )}
                  </div>

                  {/* Workload Limit */}
                  <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.conditions.maxWorkload.enabled}
                        onChange={(e) => updateFormData('conditions.maxWorkload.enabled', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">Check workload limits</span>
                    </label>
                    
                    {formData.conditions.maxWorkload.enabled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Workload Percentage
                        </label>
                        <input
                          type="range"
                          min="50"
                          max="100"
                          value={formData.conditions.maxWorkload.percentage}
                          onChange={(e) => updateFormData('conditions.maxWorkload.percentage', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <div className="text-sm text-gray-600">{formData.conditions.maxWorkload.percentage}% capacity</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignment Actions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">Assignment Actions</h3>
                  
                  {/* Assignment Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assignment Method
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {assignmentMethods.map((method) => {
                        const Icon = method.icon;
                        return (
                          <label 
                            key={method.value} 
                            className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              formData.actions.assignmentMethod === method.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="assignmentMethod"
                              value={method.value}
                              checked={formData.actions.assignmentMethod === method.value}
                              onChange={(e) => updateFormData('actions.assignmentMethod', e.target.value)}
                              className="sr-only"
                            />
                            <Icon className="w-5 h-5 mr-3 text-gray-600" />
                            <div>
                              <div className="font-medium text-gray-900">{method.label}</div>
                              <div className="text-sm text-gray-600">{method.desc}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Auto Assignment */}
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.actions.autoAssign}
                        onChange={(e) => updateFormData('actions.autoAssign', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">Enable automatic assignment</span>
                    </label>
                    <p className="text-sm text-gray-600 mt-1">
                      When enabled, complaints matching this rule will be automatically assigned without admin intervention
                    </p>
                  </div>

                  {/* Notification Settings */}
                  <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <h4 className="font-medium text-gray-900">Notification Settings</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.actions.notificationSettings.assigneeNotification}
                          onChange={(e) => updateFormData('actions.notificationSettings.assigneeNotification', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Notify Assignee</span>
                      </label>
                      
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.actions.notificationSettings.userNotification}
                          onChange={(e) => updateFormData('actions.notificationSettings.userNotification', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Notify User</span>
                      </label>
                      
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.actions.notificationSettings.supervisorNotification}
                          onChange={(e) => updateFormData('actions.notificationSettings.supervisorNotification', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Notify Supervisor</span>
                      </label>
                      
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.actions.notificationSettings.escalationNotification}
                          onChange={(e) => updateFormData('actions.notificationSettings.escalationNotification', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Escalation Alerts</span>
                      </label>
                    </div>
                  </div>

                  {/* SLA Settings */}
                  <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.actions.slaSettings.useCustomSLA}
                        onChange={(e) => updateFormData('actions.slaSettings.useCustomSLA', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">Use custom SLA settings</span>
                    </label>
                    
                    {formData.actions.slaSettings.useCustomSLA && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Resolution Time (hours)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={formData.actions.slaSettings.customSLAHours}
                            onChange={(e) => updateFormData('actions.slaSettings.customSLAHours', parseInt(e.target.value))}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Response Time (hours)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={formData.actions.slaSettings.responseTimeHours}
                            onChange={(e) => updateFormData('actions.slaSettings.responseTimeHours', parseInt(e.target.value))}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Toggle */}
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => updateFormData('isActive', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">Rule is active</span>
                    </label>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingRule(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingRule ? 'Update Rule' : 'Create Rule'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentRulesConfig;