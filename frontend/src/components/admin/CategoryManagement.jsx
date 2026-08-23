import { useState, useEffect } from "react";
import { Plus, Settings2, Trash2, Folder, Clock, Hash, X } from "lucide-react";
import api from "../../services/api";
import Loader from "../common/Loader";
import { toast } from "react-hot-toast";

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' or 'edit'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
    resolutionSLA: {
      low: 168,
      medium: 72,
      high: 24,
      critical: 4,
    },
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await api.get("/categories?includeStats=true");
        setCategories(data.data);
      } catch (err) {
        toast.error("Error loading categories");
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, [refreshKey]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!showModal) {
      setFormData({
        name: "",
        description: "",
        color: "#3b82f6",
        resolutionSLA: {
          low: 168,
          medium: 72,
          high: 24,
          critical: 4,
        },
      });
      setSelectedCategory(null);
    } else if (modalMode === "edit" && selectedCategory) {
      setFormData({
        name: selectedCategory.name,
        description: selectedCategory.description || "",
        color: selectedCategory.color || "#3b82f6",
        resolutionSLA: {
          low: selectedCategory.resolutionSLA?.low || 168,
          medium: selectedCategory.resolutionSLA?.medium || 72,
          high: selectedCategory.resolutionSLA?.high || 24,
          critical: selectedCategory.resolutionSLA?.critical || 4,
        },
      });
    }
  }, [showModal, modalMode, selectedCategory]);

  const handleOpenModal = (mode, category = null) => {
    setModalMode(mode);
    setSelectedCategory(category);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (modalMode === "create") {
        await api.post("/categories", formData);
        toast.success("Category created successfully!");
      } else {
        await api.put(`/categories/${selectedCategory._id}`, formData);
        toast.success("Category updated successfully!");
      }
      setShowModal(false);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          `Failed to ${modalMode === "create" ? "create" : "update"} category`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (categoryId, categoryName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${categoryName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/categories/${categoryId}`);
      toast.success("Category deleted successfully!");
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to delete category"
      );
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("sla_")) {
      const priority = name.replace("sla_", "");
      setFormData({
        ...formData,
        resolutionSLA: {
          ...formData.resolutionSLA,
          [priority]: parseInt(value) || 0,
        },
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  if (loading) return <Loader text="Fetching configurations..." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Issue Categories</h1>
        <button
          onClick={() => handleOpenModal("create")}
          className="bg-primary text-white px-4 py-2 rounded-lg font-bold flex items-center hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> New Category
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((cat) => (
          <div
            key={cat._id}
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4"
          >
            <div
              className="p-4 rounded-xl flex-shrink-0"
              style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
            >
              <Folder className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between">
                <h3 className="font-bold text-gray-900 text-lg">{cat.name}</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleOpenModal("edit", cat)}
                    className="p-1.5 text-gray-400 hover:text-primary transition-colors"
                    title="Edit Category"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat._id, cat.name)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {cat.description || "No description provided."}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="flex items-center text-xs font-semibold text-gray-600">
                  <Clock className="w-3 h-3 mr-1 text-amber-500" /> SLA:{" "}
                  {cat.resolutionSLA?.medium || 48}h (Avg)
                </div>
                <div className="flex items-center text-xs font-semibold text-gray-600">
                  <Hash className="w-3 h-3 mr-1 text-blue-500" /> Tickets:{" "}
                  {cat.complaintCount || 0}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">
                {modalMode === "create" ? "Create New Category" : "Edit Category"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Category Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Category Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g., IT Support, Maintenance"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Brief description of this category..."
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Category Color
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="color"
                    name="color"
                    value={formData.color}
                    onChange={handleInputChange}
                    className="w-16 h-10 border border-gray-200 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

              {/* SLA Configuration */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  SLA Configuration (Hours)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Low Priority
                    </label>
                    <input
                      type="number"
                      name="sla_low"
                      value={formData.resolutionSLA.low}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Medium Priority
                    </label>
                    <input
                      type="number"
                      name="sla_medium"
                      value={formData.resolutionSLA.medium}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      High Priority
                    </label>
                    <input
                      type="number"
                      name="sla_high"
                      value={formData.resolutionSLA.high}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Critical Priority
                    </label>
                    <input
                      type="number"
                      name="sla_critical"
                      value={formData.resolutionSLA.critical}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 border border-gray-200 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? modalMode === "create"
                      ? "Creating..."
                      : "Updating..."
                    : modalMode === "create"
                      ? "Create Category"
                      : "Update Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManagement;

