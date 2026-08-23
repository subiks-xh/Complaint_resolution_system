import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { User, Mail, Shield, Camera, Save, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import authService from "../services/authService";

const Profile = () => {
  const { user, updateLocalUser } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    department: user?.department || "",
  });

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await authService.updateProfile(formData);
      updateLocalUser(formData);
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error("Update failed. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Account Settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage your personal information and security.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Avatar Sidebar */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-center">
          <div className="relative inline-block group">
            <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-700 border-4 border-white dark:border-gray-800 shadow-md flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="Profile"
                  width="128"
                  height="128"
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-16 h-16 text-gray-400" />
              )}
            </div>
            <button
              onClick={() => toast("Avatar upload will be available soon")}
              title="Avatar upload"
              className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full border-2 border-white shadow-sm hover:bg-blue-600 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <h3 className="mt-4 font-bold text-gray-900 dark:text-gray-100 text-lg">
            {user?.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-300 capitalize px-3 py-1 bg-gray-50 dark:bg-gray-700 inline-block rounded-full mt-2 font-medium">
            {user?.role} Account
          </p>
        </div>

        {/* Profile Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/40">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">
                Personal Information
              </h3>
            </div>
            <form onSubmit={handleUpdate} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-sm outline-none cursor-not-allowed"
                    value={formData.email}
                    disabled
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 ml-1">
                    Department
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-bold flex items-center hover:bg-blue-600 transition-all disabled:opacity-50"
                >
                  {isUpdating ? (
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
