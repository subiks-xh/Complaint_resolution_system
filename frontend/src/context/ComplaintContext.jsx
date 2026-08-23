import { createContext, useContext, useState, useCallback } from "react";
import api from "../services/api";

const ComplaintContext = createContext();

export const ComplaintProvider = ({ children }) => {
  const [categories, setCategories] = useState([]);
  const [myComplaints, setMyComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch Categories (Used by multiple forms)
  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await api.get("/categories");
      setCategories(data.data);
    } catch (err) {
      console.error("Failed to load categories");
    }
  }, []);

  // Fetch User's Complaints
  const fetchMyComplaints = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const { data } = await api.get("/complaints/my-complaints", { params });
      setMyComplaints(data.data.complaints);
      setError(null);
    } catch (err) {
      setError("Failed to load complaints");
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new Complaint
  const createComplaint = async (formData) => {
    setLoading(true);
    try {
      const { data } = await api.post("/complaints", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMyComplaints((prev) => [data.data, ...prev]);
      return { success: true, data: data.data };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    categories,
    myComplaints,
    loading,
    error,
    fetchCategories,
    fetchMyComplaints,
    createComplaint,
  };

  return (
    <ComplaintContext.Provider value={value}>
      {children}
    </ComplaintContext.Provider>
  );
};

export const useComplaints = () => {
  const context = useContext(ComplaintContext);
  if (!context) {
    throw new Error("useComplaints must be used within a ComplaintProvider");
  }
  return context;
};
