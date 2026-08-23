import { useEffect, useState } from "react";
import {
  Archive,
  Edit3,
  FileText,
  Plus,
  RefreshCw,
  Send,
  Save,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import Loader from "../common/Loader";

const emptyForm = {
  name: "",
  body: "",
  type: "status_update",
  audience: "staff",
  tags: "",
};

const TemplateLibrary = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [complaintId, setComplaintId] = useState("");
  const [applyMode, setApplyMode] = useState("internal_note");
  const [setStatus, setSetStatus] = useState("");

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/templates");
      setTemplates(data.data || []);
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await loadTemplates();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingTemplate(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.body.trim()) {
      toast.error("Template name and body are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      if (editingTemplate) {
        await api.put(`/templates/${editingTemplate._id}`, payload);
        toast.success("Template updated");
      } else {
        await api.post("/templates", payload);
        toast.success("Template created");
      }

      resetForm();
      await loadTemplates();
    } catch (error) {
      console.error("Template save error:", error);
      toast.error(error.response?.data?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setForm({
      name: template.name || "",
      body: template.body || "",
      type: template.type || "status_update",
      audience: template.audience || "staff",
      tags: Array.isArray(template.tags) ? template.tags.join(", ") : "",
    });
  };

  const handleArchive = async (templateId) => {
    if (!window.confirm("Archive this template?")) {
      return;
    }

    try {
      await api.delete(`/templates/${templateId}`);
      toast.success("Template archived");
      await loadTemplates();
    } catch (error) {
      console.error("Archive template error:", error);
      toast.error(
        error.response?.data?.message || "Failed to archive template",
      );
    }
  };

  const applyTemplate = async (templateId) => {
    if (!complaintId.trim()) {
      toast.error("Enter a complaint ID first");
      return;
    }

    try {
      await api.post(`/templates/${templateId}/apply/${complaintId.trim()}`, {
        mode: applyMode,
        setStatus: setStatus || undefined,
      });
      toast.success("Template applied");
    } catch (error) {
      console.error("Apply template error:", error);
      toast.error(error.response?.data?.message || "Failed to apply template");
    }
  };

  if (loading) {
    return <Loader fullScreen text="Loading templates..." />;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-indigo-100 text-sm font-medium">Templates</p>
            <h1 className="text-3xl font-bold mt-1">
              Response Template Library
            </h1>
            <p className="text-indigo-100 mt-2 max-w-2xl">
              Create reusable responses, apply them to complaints, and keep
              staff messaging consistent.
            </p>
          </div>

          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/20 disabled:opacity-60"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span>{refreshing ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {editingTemplate ? "Edit Template" : "Create Template"}
              </h2>
              <p className="text-sm text-gray-500">
                Reusable content for staff and admins.
              </p>
            </div>
            <Plus className="w-5 h-5 text-indigo-600" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Template name"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              rows="5"
              value={form.body}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, body: event.target.value }))
              }
              placeholder="Template body"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, type: event.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="status_update">Status Update</option>
                <option value="resolution_note">Resolution Note</option>
                <option value="internal_note">Internal Note</option>
              </select>
              <select
                value={form.audience}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, audience: event.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="all">All</option>
              </select>
            </div>
            <input
              value={form.tags}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, tags: event.target.value }))
              }
              placeholder="Tags, comma separated"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>
                  {saving
                    ? "Saving..."
                    : editingTemplate
                      ? "Update Template"
                      : "Create Template"}
                </span>
              </button>
              {editingTemplate && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Apply Template
              </h2>
              <p className="text-sm text-gray-500">
                Use a template on a complaint by ID.
              </p>
            </div>
            <Send className="w-5 h-5 text-green-600" />
          </div>

          <div className="space-y-4">
            <input
              value={complaintId}
              onChange={(event) => setComplaintId(event.target.value)}
              placeholder="Complaint ObjectId"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={applyMode}
                onChange={(event) => setApplyMode(event.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="internal_note">Internal Note</option>
                <option value="resolution">Resolution</option>
              </select>
              <input
                value={setStatus}
                onChange={(event) => setSetStatus(event.target.value)}
                placeholder="Optional status (assigned, in-progress, resolved...)"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <p className="text-sm text-gray-500">
              After entering a complaint ObjectId, use the Apply buttons on the
              templates below.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Templates</h2>
            <p className="text-sm text-gray-500">
              Available response templates.
            </p>
          </div>
          <FileText className="w-5 h-5 text-gray-400" />
        </div>

        {templates.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No templates available.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {templates.map((template) => (
              <div
                key={template._id}
                className="p-5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {template.name}
                    </h3>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 capitalize">
                      {template.type}
                    </span>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-100 capitalize">
                      {template.audience}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap max-w-3xl">
                    {template.body}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>Usage: {template.usageCount || 0}</span>
                    {template.tags?.length > 0 && (
                      <span>Tags: {template.tags.join(", ")}</span>
                    )}
                    <span>
                      Updated:{" "}
                      {template.updatedAt
                        ? new Date(template.updatedAt).toLocaleString()
                        : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => applyTemplate(template._id)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 text-sm font-medium"
                  >
                    <Send className="w-4 h-4" />
                    Apply
                  </button>
                  <button
                    onClick={() => handleEdit(template)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleArchive(template._id)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-sm font-medium"
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateLibrary;
