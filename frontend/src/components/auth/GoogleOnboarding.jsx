import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import * as z from "zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const onboardingSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(10, "Valid phone is required"),
  department: z.string().min(1, "Department is required"),
  orgCode: z.string().min(6, "Organization code is required"),
  organizationType: z.enum(["college", "company", "institute", "other"]),
  userIdentifier: z.string().min(2, "Identifier is required"),
  preferredPaymentMode: z.enum(["online", "offline", "either"]),
  preferredPaymentTimeSlot: z.enum([
    "morning",
    "afternoon",
    "evening",
    "night",
    "anytime",
  ]),
});

const GoogleOnboarding = () => {
  const navigate = useNavigate();
  const { user, completeGoogleOnboarding, loading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      fullName: user?.name || "",
      phone: user?.phone || "",
      department: user?.department || "",
      orgCode: "",
      organizationType: "college",
      userIdentifier: "",
      preferredPaymentMode: "either",
      preferredPaymentTimeSlot: "anytime",
    },
  });

  const onSubmit = async (values) => {
    try {
      await completeGoogleOnboarding(values);
      toast.success("Onboarding completed successfully");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to complete onboarding",
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            Complete your onboarding
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Finish profile setup before entering your dashboard.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Full Name
              </label>
              <input
                {...register("fullName")}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder="Your full name"
              />
              {errors.fullName && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Phone Number
              </label>
              <input
                {...register("phone")}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder="9876543210"
              />
              {errors.phone && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Department
              </label>
              <input
                {...register("department")}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder="Computer Science"
              />
              {errors.department && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.department.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Organization Code
              </label>
              <input
                {...register("orgCode")}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder="ORG123"
              />
              {errors.orgCode && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.orgCode.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Organization Type
              </label>
              <select
                {...register("organizationType")}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              >
                <option value="college">College</option>
                <option value="company">Company</option>
                <option value="institute">Institute</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                ID / Roll / Employee No.
              </label>
              <input
                {...register("userIdentifier")}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                placeholder="CS23A001"
              />
              {errors.userIdentifier && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.userIdentifier.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Preferred Payment Mode
              </label>
              <select
                {...register("preferredPaymentMode")}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              >
                <option value="either">Either</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Preferred Payment Time
              </label>
              <select
                {...register("preferredPaymentTimeSlot")}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              >
                <option value="anytime">Anytime</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="w-full mt-2 flex items-center justify-center py-3 rounded-xl bg-primary text-white font-semibold hover:bg-blue-600 transition-all disabled:opacity-70"
          >
            {isSubmitting || loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Complete and Continue
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default GoogleOnboarding;
