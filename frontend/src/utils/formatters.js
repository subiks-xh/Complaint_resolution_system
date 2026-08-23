import { format, formatDistanceToNow } from "date-fns";

/**
 * Format a date string to a human-readable format
 * @example Jan 25, 2024
 */
export const formatDate = (date) => {
  if (!date) return "N/A";
  return format(new Date(date), "MMM dd, yyyy");
};

/**
 * Format a date to relative time
 * @example 2 hours ago
 */
export const formatRelativeTime = (date) => {
  if (!date) return "N/A";
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

/**
 * Maps a status to a CSS color class
 */
export const getStatusStyles = (status) => {
  const styles = {
    new: "bg-blue-100 text-blue-700 border-blue-200",
    assigned: "bg-indigo-100 text-indigo-700 border-indigo-200",
    "in-progress": "bg-amber-100 text-amber-700 border-amber-200",
    resolved: "bg-green-100 text-green-700 border-green-200",
    closed: "bg-gray-100 text-gray-700 border-gray-200",
    escalated: "bg-red-100 text-red-700 border-red-200",
    reopened: "bg-purple-100 text-purple-700 border-purple-200",
  };
  return styles[status] || "bg-gray-100 text-gray-700";
};

/**
 * Maps priority to CSS color class
 */
export const getPriorityStyles = (priority) => {
  const styles = {
    low: "text-gray-600 bg-gray-100",
    medium: "text-blue-600 bg-blue-50",
    high: "text-orange-600 bg-orange-50",
    critical: "text-red-600 bg-red-50 animate-pulse",
  };
  return styles[priority] || "text-gray-600 bg-gray-100";
};

/**
 * Formats bytes to human-readable size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
