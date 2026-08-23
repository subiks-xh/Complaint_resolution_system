import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import api from "../services/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get("/auth/me");
      setUser(data.data.user);
    } catch (err) {
      localStorage.removeItem("accessToken");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login Function
  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      const { accessToken, user: userData } = data.data;

      localStorage.setItem("accessToken", accessToken);
      setUser(userData);
      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  // Google Auth Function
  const loginWithGoogle = async (credential, intent = "login") => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/google", { credential, intent });
      const { accessToken, user: userData, onboardingRequired } = data.data;

      localStorage.setItem("accessToken", accessToken);
      setUser(userData);

      return { success: true, onboardingRequired: !!onboardingRequired };
    } finally {
      setLoading(false);
    }
  };

  // Complete onboarding after first Google signup
  const completeGoogleOnboarding = async (payload) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/google/onboarding", payload);
      const { accessToken, user: userData } = data.data;

      localStorage.setItem("accessToken", accessToken);
      setUser(userData);

      return { success: true };
    } finally {
      setLoading(false);
    }
  };

  // Register Function
  const register = async (userData) => {
    const { data } = await api.post("/auth/register", userData);
    return { success: true, message: data.message };
  };

  // Register Organization Function
  const registerOrg = async (orgData) => {
    const { data } = await api.post("/auth/register-org", orgData);
    return { success: true, message: data.message, data: data.data };
  };

  // Logout Function
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      localStorage.removeItem("accessToken");
      setUser(null);
    }
  };

  // Update Profile Local State
  const updateLocalUser = (updatedData) => {
    setUser((prev) => ({ ...prev, ...updatedData }));
  };

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    registerOrg,
    loginWithGoogle,
    completeGoogleOnboarding,
    checkAuth,
    updateLocalUser,
    isAuthenticated: !!user,
    isAdmin: ["admin", "org_admin", "super_admin"].includes(user?.role),
    isStaff: user?.role === "staff",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
