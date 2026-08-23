import * as z from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    department: z.string().min(1, "Please select your department"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const complaintSchema = z.object({
  title: z.string().min(5, "Subject must be at least 5 characters").max(100),
  category: z.string().min(1, "Please select a category"),
  priority: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().min(20, "Please provide more detail (min 20 chars)"),
});

export const feedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  comments: z.string().max(500).optional(),
});
