import api from "./api";

const staffService = {
  getDashboard: () => api.get("/staff/dashboard"),

  getAssigned: (params) => api.get("/staff/complaints", { params }),

  getDetails: (id) => api.get(`/staff/complaints/${id}`),

  updateStatus: (id, status, remarks) =>
    api.put(`/staff/complaints/${id}/status`, { status, remarks }),

  startWork: (id) => api.put(`/staff/complaints/${id}/start`),

  addNote: (id, note) => api.post(`/staff/complaints/${id}/notes`, { note }),

  resolve: (id, formData) =>
    api.post(`/staff/complaints/${id}/resolve`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  requestReassignment: (id, reason) =>
    api.post(`/staff/complaints/${id}/request-reassignment`, { reason }),

  getPerformance: (period) => api.get(`/staff/performance?period=${period}`),
};

export default staffService;
