import api from "./api";

const complaintService = {
  create: (formData) =>
    api.post("/complaints", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  getMyComplaints: (params) => api.get("/complaints/my-complaints", { params }),

  getById: (id) => api.get(`/complaints/${id}`),

  getTimeline: (id) => api.get(`/complaints/${id}/timeline`),

  cancel: (id, reason) => api.put(`/complaints/${id}/cancel`, { reason }),

  reopen: (id, reason) => api.put(`/complaints/${id}/reopen`, { reason }),

  getStats: () => api.get("/complaints/my-stats"),

  search: (query) => api.get(`/complaints/search?q=${query}`),

  addAttachments: (id, formData) =>
    api.post(`/complaints/${id}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export default complaintService;
