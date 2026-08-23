import api from "./api";

const adminService = {
  getDashboard: () => api.get("/admin/dashboard"),

  getAllComplaints: (params) => api.get("/admin/complaints", { params }),

  assignStaff: (id, staffId) =>
    api.post(`/admin/complaints/${id}/assign`, { staffId }),

  reassignStaff: (id, staffId, reason) =>
    api.put(`/admin/complaints/${id}/reassign`, { staffId, reason }),

  getEscalations: () => api.get("/admin/complaints/escalated"),

  getAllStaff: () => api.get("/admin/staff"),

  getAvailableStaff: (categoryId) =>
    api.get(`/admin/staff/available?category=${categoryId}`),

  getAnalytics: (period) => api.get(`/admin/analytics?period=${period}`),

  // Category Management
  getCategories: () => api.get("/categories?includeStats=true"),
  createCategory: (data) => api.post("/categories", data),
  updateCategory: (id, data) => api.put(`/categories/${id}`, data),

  // Announcements
  createAnnouncement: (data) => api.post("/admin/announcements", data),
};

export default adminService;
