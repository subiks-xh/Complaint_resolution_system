import api from "./api";

const authService = {
  login: (email, password) => api.post("/auth/login", { email, password }),

  register: (userData) => api.post("/auth/register", userData),

  registerOrganization: (orgData) => api.post("/auth/register-org", orgData),

  logout: () => api.post("/auth/logout"),

  getMe: () => api.get("/auth/me"),

  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),

  resetPassword: (token, password) =>
    api.post(`/auth/reset-password/${token}`, { password }),

  changePassword: (data) => api.put("/auth/change-password", data),

  updateProfile: (data) => api.put("/users/profile", data),

  getNotificationPreferences: () => api.get("/users/notification-preferences"),

  updateNotificationPreferences: (prefs) =>
    api.put("/users/notification-preferences", prefs),

  updateAvatar: (formData) =>
    api.put("/users/profile/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export default authService;
