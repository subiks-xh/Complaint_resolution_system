import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { User, Mail, Shield, Camera, Save, Loader2, Bell, AlertTriangle } from "lucide-react";
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

  const [notificationPreferences, setNotificationPreferences] = useState({
    inApp: true,
    email: true,
    complaintUpdates: true,
    escalationAlerts: true,
  });
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchPreferences = async () => {
      try {
        const response = await authService.getNotificationPreferences();
        if (isMounted && response?.data) {
          setNotificationPreferences({
            inApp: response.data.inApp ?? true,
            email: response.data.email ?? true,
            complaintUpdates: response.data.complaintUpdates ?? true,
            escalationAlerts: response.data.escalationAlerts ?? true,
          });
        }
      } catch (err) {
        // Fall back to user object if endpoint fails
        if (isMounted && user?.notificationPreferences) {
          setNotificationPreferences({
            inApp: user.notificationPreferences.inApp ?? true,
            email: user.notificationPreferences.email ?? true,
            complaintUpdates: user.notificationPreferences.complaintUpdates ?? true,
            escalationAlerts: user.notificationPreferences.escalationAlerts ?? true,
          });
        }
      } finally {
        if (isMounted) setIsLoadingPreferences(false);
      }
    };

    fetchPreferences();
    return () => {
      isMounted = false;
    };
  }, [user]);

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

  const handleTogglePreference = (key) => {
    setNotificationPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setIsSavingPreferences(true);
    try {
      const response = await authService.updateNotificationPreferences(notificationPreferences);
      const updated = response?.data || notificationPreferences;
      setNotificationPreferences(updated);
      updateLocalUser({ notificationPreferences: updated });
      toast.success("Notification preferences saved successfully");
    } catch (err) {
      toast.error("Failed to save notification preferences");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Account Settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Manage your personal information, security, and notification preferences.
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
        <div className="lg:col-span-2 space-y-8">
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

          {/* Notification Preferences Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/40 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center">
                  <Bell className="w-5 h-5 mr-2 text-primary" />
                  Notification Preferences
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Control which notification channels and alert categories you receive.
                </p>
              </div>
            </div>

            <form onSubmit={handleSavePreferences} className="p-8 space-y-6">
              {isLoadingPreferences ? (
                <div className="flex items-center justify-center py-6 text-gray-400">
                  <Loader2 className="animate-spin w-6 h-6 mr-2" />
                  Loading preferences...
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {/* In-App Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                      <div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          In-App Notifications
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Receive notifications inside the notification bell drawer.
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={notificationPreferences.inApp}
                          onChange={() => handleTogglePreference("inApp")}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    {/* Email Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                      <div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          Email Notifications
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Receive notifications via your registered email address.
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={notificationPreferences.email}
                          onChange={() => handleTogglePreference("email")}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    {/* Complaint Updates Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                      <div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          Complaint Updates
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Status transitions, assignment notifications, and resolution updates.
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={notificationPreferences.complaintUpdates}
                          onChange={() => handleTogglePreference("complaintUpdates")}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    {/* Escalation Alerts Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                      <div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          Escalation & SLA Alerts
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Escalation notices, SLA threshold warnings, and breach notifications.
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={notificationPreferences.escalationAlerts}
                          onChange={() => handleTogglePreference("escalationAlerts")}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>

                  {/* Mandatory Security Notice */}
                  <div className="flex items-start p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 mr-2 shrink-0 mt-0.5" />
                    <span>
                      <strong>Mandatory Security Notifications:</strong> Account security alerts, password resets, and critical verification notices are always sent regardless of your preferences.
                    </span>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingPreferences}
                      className="px-6 py-3 bg-primary text-white rounded-xl font-bold flex items-center hover:bg-blue-600 transition-all disabled:opacity-50"
                    >
                      {isSavingPreferences ? (
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Preferences
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
