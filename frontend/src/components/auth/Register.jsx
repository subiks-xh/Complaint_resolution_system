import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Shield,
  Mail,
  Lock,
  User,
  Phone,
  Building,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import GoogleAuthButton from "./GoogleAuthButton";

// Schema for Joining an Organization
const joinSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(10, "Invalid phone number"),
    department: z.string().min(1, "Please select your department"),
    orgCode: z.string().min(6, "Organization Code is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Schema for Creating an Organization
const createOrgSchema = z
  .object({
    orgName: z.string().min(2, "Organization Name is required"),
    orgEmail: z.string().email("Invalid Organization Email"),
    adminName: z.string().min(2, "Admin Name is required"),
    adminEmail: z.string().email("Invalid Admin Email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const JoinForm = ({ onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register: registerAuth } = useAuth(); // rename to avoid conflict

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(joinSchema),
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await registerAuth(data);
      toast.success("Registration successful! Please login.");
      onSuccess();
    } catch (err) {
      const resp = err.response?.data;
      if (resp?.errors && Array.isArray(resp.errors)) {
        resp.errors.forEach((e) => {
          const fieldName = e.field || e.param || "";
          if (fieldName) {
            setError(fieldName, { type: "server", message: e.message });
          }
        });
        toast.error(resp.message || "Validation failed");
      } else {
        toast.error(resp?.message || "Registration failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              {...register("name")}
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="John Doe"
            />
          </div>
          {errors.name && (
            <p className="text-red-500 text-xs ml-1">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              {...register("email")}
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="john@company.com"
            />
          </div>
          {errors.email && (
            <p className="text-red-500 text-xs ml-1">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
            Phone Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Phone className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              {...register("phone")}
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="+1 (555) 000-0000"
            />
          </div>
          {errors.phone && (
            <p className="text-red-500 text-xs ml-1">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
            Department
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Building className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            </div>
            <select
              {...register("department")}
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 outline-none appearance-none"
            >
              <option value="">Select Department</option>
              <option value="IT">IT Support</option>
              <option value="HR">Human Resources</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
              <option value="Sales">Sales & Marketing</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {errors.department && (
            <p className="text-red-500 text-xs ml-1">
              {errors.department.message}
            </p>
          )}
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
            Organization Code
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Shield className="h-4 w-4 text-indigo-500" />
            </div>
            <input
              {...register("orgCode")}
              className="block w-full pl-10 pr-3 py-2.5 border-2 border-indigo-100 dark:border-indigo-900 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all"
              placeholder="Enter the 6-character code provided by your admin"
            />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
            Ask your Organization Admin for this code to join their workspace.
          </p>
          {errors.orgCode && (
            <p className="text-red-500 text-xs ml-1">
              {errors.orgCode.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              {...register("password")}
              type="password"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="••••••••"
            />
          </div>
          {errors.password && (
            <p className="text-red-500 text-xs ml-1">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <CheckCircle2 className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              {...register("confirmPassword")}
              type="password"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="••••••••"
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-red-500 text-xs ml-1">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="group relative w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all shadow-lg shadow-primary/30"
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin h-5 w-5" />
          ) : (
            "Join Organization"
          )}
        </button>
      </div>
    </form>
  );
};

const CreateOrgForm = ({ onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { registerOrg } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createOrgSchema),
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      // Map password to adminPassword for backend
      const payload = { ...data, adminPassword: data.password };
      await registerOrg(payload);
      toast.success(
        "Organization created successfully! Please login as Admin.",
      );
      onSuccess();
    } catch (err) {
      const resp = err.response?.data;
      toast.error(resp?.message || "Failed to create organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
      {/* Organization Details */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 mb-4">
        <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center">
          <Building className="w-4 h-4 mr-2" /> Organization Details
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
              Workspace Name
            </label>
            <input
              {...register("orgName")}
              className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Acme Corp"
            />
            {errors.orgName && (
              <p className="text-red-500 text-xs ml-1">
                {errors.orgName.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
              Contact Email
            </label>
            <input
              {...register("orgEmail")}
              className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="contact@acme.com"
            />
            {errors.orgEmail && (
              <p className="text-red-500 text-xs ml-1">
                {errors.orgEmail.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Admin Details */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center">
          <User className="w-4 h-4 mr-2" /> Admin Account
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
              Admin Name
            </label>
            <input
              {...register("adminName")}
              className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Admin Name"
            />
            {errors.adminName && (
              <p className="text-red-500 text-xs ml-1">
                {errors.adminName.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
              Admin Email
            </label>
            <input
              {...register("adminEmail")}
              className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="admin@acme.com"
            />
            {errors.adminEmail && (
              <p className="text-red-500 text-xs ml-1">
                {errors.adminEmail.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
              Password
            </label>
            <input
              {...register("password")}
              type="password"
              className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-red-500 text-xs ml-1">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">
              Confirm Password
            </label>
            <input
              {...register("confirmPassword")}
              type="password"
              className="block w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs ml-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="group relative w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-lg shadow-indigo-500/30"
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin h-5 w-5" />
          ) : (
            "Create Organization & Admin"
          )}
        </button>
      </div>
    </form>
  );
};

const Register = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("join"); // 'join' | 'create'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-8 bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            {mode === "join" ? "Join Workspace" : "Create Workspace"}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-balance">
            {mode === "join"
              ? "Join your team to start managing complaints."
              : "Set up a new workspace for your organization."}
          </p>
        </div>

        {/* Toggle Switch */}
        <div className="flex justify-center mt-6">
          <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex">
            <button
              onClick={() => setMode("join")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "join"
                  ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              Join Existing
            </button>
            <button
              onClick={() => setMode("create")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "create"
                  ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              Create New
            </button>
          </div>
        </div>

        {mode === "join" ? (
          <JoinForm onSuccess={() => navigate("/login")} />
        ) : (
          <CreateOrgForm onSuccess={() => navigate("/login")} />
        )}

        {mode === "join" && (
          <>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-gray-800 px-3 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  or sign up with
                </span>
              </div>
            </div>

            <GoogleAuthButton
              mode="signup"
              onSuccessRedirect={(path) => navigate(path)}
            />
          </>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-primary dark:text-blue-400 hover:text-primary/80 dark:hover:text-blue-300 transition-colors"
            >
              Sign in instead
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
