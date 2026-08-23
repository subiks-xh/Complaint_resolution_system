/**
 * Response Template Model
 *
 * Reusable response templates for staff/admin teams.
 */

const mongoose = require("mongoose");

const responseTemplateSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Template name is required"],
      trim: true,
      maxlength: [120, "Template name cannot exceed 120 characters"],
    },

    type: {
      type: String,
      enum: ["status_update", "resolution", "request_info", "closure"],
      default: "status_update",
    },

    body: {
      type: String,
      required: [true, "Template body is required"],
      minlength: [10, "Template body must be at least 10 characters"],
      maxlength: [4000, "Template body cannot exceed 4000 characters"],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    audience: {
      type: String,
      enum: ["staff", "admin", "all"],
      default: "staff",
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    usageCount: {
      type: Number,
      default: 0,
    },

    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

responseTemplateSchema.index({ organization: 1, audience: 1, isActive: 1 });
responseTemplateSchema.index({ name: "text", body: "text" });

module.exports = mongoose.model("ResponseTemplate", responseTemplateSchema);
