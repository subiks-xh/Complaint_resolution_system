/**
 * Organization Model
 *
 * Represents a workspace/tenant in the system.
 * Contains settings and details specific to an organization.
 */

const mongoose = require("mongoose");
const crypto = require("crypto");

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    // Unique code for users to join (e.g., "ABC-123")
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    // Contact Email for the organization
    email: {
      type: String,
      required: [true, "Contact email is required"],
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please provide a valid email address",
      ],
    },

    address: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },

    // Plan/Subscription (for future use)
    plan: {
      type: String,
      enum: ["free", "pro", "enterprise"],
      default: "free",
    },

    // Settings specific to this organization
    settings: {
      allowUserRegistration: {
        type: Boolean,
        default: true,
      },
      requireEmailVerification: {
        type: Boolean,
        default: false,
      },
      defaultComplaintPriority: {
        type: String,
        default: "medium",
      },
    },
  },
  {
    timestamps: true,
  },
);

// Method to generate a unique org code
organizationSchema.statics.generateCode = function (name) {
  // Take first 3 chars of name or random
  const prefix =
    name && name.length >= 3
      ? name
          .substring(0, 3)
          .toUpperCase()
          .replace(/[^A-Z]/g, "X")
      : "ORG";
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${randomSuffix}`;
};

const Organization = mongoose.model("Organization", organizationSchema);

module.exports = Organization;
