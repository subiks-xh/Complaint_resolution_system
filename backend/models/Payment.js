/**
 * Payment Model
 *
 * Tracks complaint-linked payment flows for premium handling,
 * service fees, or verification charges.
 */

const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paymentRef: {
      type: String,
      unique: true,
      index: true,
    },

    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    complaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },

    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [1, "Amount must be at least 1"],
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      maxlength: 5,
    },

    purpose: {
      type: String,
      enum: ["premium_escalation", "service_fee", "verification_fee"],
      default: "premium_escalation",
    },

    method: {
      type: String,
      enum: ["upi", "card", "netbanking", "cash", "manual", "demo"],
      default: "demo",
    },

    gateway: {
      type: String,
      enum: ["none", "razorpay", "stripe", "manual"],
      default: "none",
    },

    gatewayOrderId: {
      type: String,
      default: null,
    },

    gatewayPaymentId: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["initiated", "paid", "failed", "refunded"],
      default: "initiated",
      index: true,
    },

    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },

    paidAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

paymentSchema.index({ organization: 1, createdAt: -1 });
paymentSchema.index({ paidBy: 1, createdAt: -1 });
paymentSchema.index({ complaint: 1, createdAt: -1 });

paymentSchema.pre("save", async function (next) {
  if (!this.isNew || this.paymentRef) return next();

  const year = new Date().getFullYear();
  const prefix = `PAY-${year}-`;

  const last = await this.constructor
    .findOne({ paymentRef: new RegExp(`^${prefix}`) })
    .sort({ paymentRef: -1 })
    .select("paymentRef");

  let seq = 1;
  if (last?.paymentRef) {
    const parts = last.paymentRef.split("-");
    seq = parseInt(parts[2], 10) + 1;
  }

  this.paymentRef = `${prefix}${String(seq).padStart(6, "0")}`;
  next();
});

module.exports = mongoose.model("Payment", paymentSchema);
