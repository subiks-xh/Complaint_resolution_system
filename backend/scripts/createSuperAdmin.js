const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");
const path = require("path");

// Load env vars
dotenv.config({ path: path.join(__dirname, "../.env") });

const createSuperAdmin = async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not defined in .env");
    }
    await mongoose.connect(uri);
    console.log("MongoDB Connected");

    const superAdminEmail =
      process.env.SUPER_ADMIN_EMAIL || "superadmin@platform.com";
    const superAdminPassword =
      process.env.SUPER_ADMIN_PASSWORD || "SuperSecretPass123!";

    // Check if exists
    const existing = await User.findOne({ email: superAdminEmail });
    if (existing) {
      console.log("Super Admin already exists");
      process.exit(0);
    }

    const superAdmin = await User.create({
      name: "Platform Owner",
      email: superAdminEmail,
      password: superAdminPassword,
      role: "super_admin",
      // organization: null // Explicitly null, might need schema adjustment if validation fails
    });

    console.log(`Super Admin created successfully: ${superAdmin.email}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

createSuperAdmin();
