import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "react-hot-toast";
import FileUpload from "../common/FileUpload";
import api from "../../services/api";

const complaintSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  category: z.string().min(1, "Please select a category"),
  priority: z.enum(["low", "medium", "high"]),
  description: z
    .string()
    .min(20, "Please describe your issue in detail (min 20 chars)"),
});

const ComplaintForm = () => {
  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(complaintSchema),
    defaultValues: { priority: "medium" },
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await api.get("/categories");
        setCategories(data.data);
      } catch (err) {
        toast.error("Failed to load categories");
      }
    };
    fetchCategories();
  }, []);

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    const formData = new FormData();

    // Append text fields
    Object.keys(values).forEach((key) => formData.append(key, values[key]));

    // Append files
    files.forEach((file) => formData.append("attachments", file));

    try {
      await api.post("/complaints", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Complaint submitted successfully!");
      reset();
      setFiles([]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      aria-labelledby="complaint-form-title"
      className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
    >
      <div className="mb-8">
        <h2
          id="complaint-form-title"
          className="text-2xl font-bold text-gray-900 dark:text-white"
        >
          Submit a New Complaint
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Provide details about your issue and we'll assign it to the right
          team.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category */}
          <div className="space-y-2">
            <label
              htmlFor="complaint-category"
              className="text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Category
            </label>
            <select
              id="complaint-category"
              {...register("category")}
              aria-invalid={errors.category ? "true" : "false"}
              aria-describedby={
                errors.category ? "complaint-category-error" : undefined
              }
              className={`w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all text-gray-900 dark:text-white bg-white dark:bg-gray-700 ${errors.category ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
            >
              <option value="" className="text-gray-500 dark:text-gray-400">
                Select Category
              </option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id} className="text-gray-900 dark:text-white dark:bg-gray-700">
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.category && (
              <p
                id="complaint-category-error"
                role="alert"
                className="text-xs text-red-500 flex items-center mt-1"
              >
                <AlertCircle aria-hidden="true" className="w-3 h-3 mr-1" />{" "}
                {errors.category.message}
              </p>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <label
              htmlFor="complaint-priority"
              className="text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Priority
            </label>
            <select
              id="complaint-priority"
              {...register("priority")}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="low" className="text-gray-900 dark:text-white dark:bg-gray-700">
                Low - Routine inquiry
              </option>
              <option value="medium" className="text-gray-900 dark:text-white dark:bg-gray-700">
                Medium - Standard issue
              </option>
              <option value="high" className="text-gray-900 dark:text-white dark:bg-gray-700">
                High - Urgent attention
              </option>
            </select>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <label
            htmlFor="complaint-title"
            className="text-sm font-semibold text-gray-700 dark:text-gray-200"
          >
            Subject / Title
          </label>
          <input
            id="complaint-title"
            {...register("title")}
            placeholder="Brief summary of the issue"
            aria-invalid={errors.title ? "true" : "false"}
            aria-describedby={
              errors.title ? "complaint-title-error" : undefined
            }
            className={`w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 ${errors.title ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
          />
          {errors.title && (
            <p
              id="complaint-title-error"
              role="alert"
              className="text-xs text-red-500 mt-1"
            >
              {errors.title.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label
            htmlFor="complaint-description"
            className="text-sm font-semibold text-gray-700 dark:text-gray-200"
          >
            Detailed Description
          </label>
          <textarea
            id="complaint-description"
            {...register("description")}
            rows="5"
            placeholder="Please explain the problem clearly..."
            aria-invalid={errors.description ? "true" : "false"}
            aria-describedby={
              errors.description ? "complaint-description-error" : undefined
            }
            className={`w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 ${errors.description ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
          ></textarea>
          {errors.description && (
            <p
              id="complaint-description-error"
              role="alert"
              className="text-xs text-red-500 mt-1"
            >
              {errors.description.message}
            </p>
          )}
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Attachments (Optional)
          </label>
          <FileUpload onFilesSelected={setFiles} />
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-blue-600 transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="w-5 h-5 mr-2 animate-spin"
                />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Send aria-hidden="true" className="w-5 h-5 mr-2" />{" "}
                <span>Submit Complaint</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
};

export default ComplaintForm;
