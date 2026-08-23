/**
 * Safely extracts error message from Axios error object
 */
export const getErrorMessage = (error) => {
  return (
    error.response?.data?.message ||
    error.message ||
    "An unexpected error occurred"
  );
};

/**
 * Truncates text with ellipsis
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

/**
 * Checks if a user has the required permission role
 */
export const hasRole = (user, roles) => {
  if (!user) return false;
  if (Array.isArray(roles)) {
    return roles.includes(user.role);
  }
  return user.role === roles;
};

/**
 * Generates a random color hex (for category defaults)
 */
export const getRandomColor = () => {
  const colors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#6366f1",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Download a file from a URL
 */
export const downloadFile = (url, filename) => {
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  link.setAttribute("target", "_blank");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
