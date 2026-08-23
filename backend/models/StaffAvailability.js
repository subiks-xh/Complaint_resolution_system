const mongoose = require("mongoose");

const specialLeaveSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false },
);

const staffAvailabilitySchema = new mongoose.Schema(
  {
    staffMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    startTime: {
      type: String,
      required: true,
      default: "09:00",
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    endTime: {
      type: String,
      required: true,
      default: "17:00",
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    specialLeaves: [specialLeaveSchema],
  },
  { timestamps: true },
);

staffAvailabilitySchema.index(
  { staffMember: 1, dayOfWeek: 1 },
  { unique: true },
);

staffAvailabilitySchema.statics.getAvailableStaffIds = async function (
  organization,
  atDate = new Date(),
) {
  const dayOfWeek = atDate.getDay();
  const hh = `${atDate.getHours()}`.padStart(2, "0");
  const mm = `${atDate.getMinutes()}`.padStart(2, "0");
  const currentTime = `${hh}:${mm}`;

  const startOfDay = new Date(atDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(atDate);
  endOfDay.setHours(23, 59, 59, 999);

  const entries = await this.find({
    organization,
    dayOfWeek,
    isAvailable: true,
    startTime: { $lte: currentTime },
    endTime: { $gte: currentTime },
    $or: [
      { specialLeaves: { $size: 0 } },
      {
        specialLeaves: {
          $not: {
            $elemMatch: {
              date: { $gte: startOfDay, $lte: endOfDay },
            },
          },
        },
      },
    ],
  }).select("staffMember");

  return entries.map((entry) => entry.staffMember.toString());
};

module.exports = mongoose.model("StaffAvailability", staffAvailabilitySchema);
