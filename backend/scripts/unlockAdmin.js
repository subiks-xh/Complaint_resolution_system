const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("../models/User");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

(async () => {
  try {
    const uri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/complaint_system";
    await mongoose.connect(uri);

    const email = process.env.UNLOCK_ADMIN_EMAIL || "admin@example.com";

    const result = await User.updateOne(
      { email: email.toLowerCase() },
      {
        $set: {
          loginAttempts: 0,
          isActive: true,
          isEmailVerified: true,
        },
        $unset: {
          lockUntil: 1,
        },
      },
    );

    console.log("Admin unlock result:", result);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Failed to unlock admin:", error);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
})();
