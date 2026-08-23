import api from "./api";

const feedbackService = {
  submit: (feedbackData) => api.post("/feedback", feedbackData),

  getByComplaintId: (id) => api.get(`/feedback/complaint/${id}`),

  getMyFeedback: (params) => api.get("/feedback/my-feedback", { params }),

  getStaffFeedback: (params) =>
    api.get("/feedback/staff/my-feedback", { params }),

  getStats: (params) => api.get("/feedback/stats", { params }),

  respondToFeedback: (id, response) =>
    api.post(`/feedback/${id}/respond`, { response }),
};

export default feedbackService;
