/**
 * Create Test User for TechFlow Organization
 * Run: node backend/scripts/createTestUser.js
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const Organization = require("../models/Organization");

const createTestUser = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI or MONGO_URI is required in backend/.env");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB Connected");

    // Find TechFlow organization
    const techflow = await Organization.findOne({ code: "TEC-05D811" });
    
    if (!techflow) {
      console.log("❌ TechFlow organization not found!");
      console.log("Please run the organization creation first");
      process.exit(1);
    }

    console.log(`✅ Found organization: ${techflow.name}`);

    // Check if user already exists
    const existingUser = await User.findOne({ email: "testuser@techflow.com" });
    
    if (existingUser) {
      console.log("✅ Test user already exists!");
      console.log("\n🔑 Test User Credentials:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("Email:    testuser@techflow.com");
      console.log("Password: Test@123");
      console.log("Name:     Test User");
      console.log("Role:     user");
      console.log("Org:      TechFlow Solutions");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      process.exit(0);
    }

    // Create test user
    const testUser = await User.create({
      name: "Test User",
      email: "testuser@techflow.com",
      password: "Test@123",
      phone: "+1234567890",
      department: "Customer Support",
      role: "user",
      organization: techflow._id,
      isEmailVerified: true,
      isActive: true,
    });

    console.log("✅ Test user created successfully!\n");
    console.log("🔑 Test User Credentials:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Email:    testuser@techflow.com");
    console.log("Password: Test@123");
    console.log("Name:     Test User");
    console.log("Role:     user");
    console.log("Org:      TechFlow Solutions");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("📝 Usage Instructions:");
    console.log("1. Go to http://localhost:5173/login");
    console.log("2. Login with the credentials above");
    console.log("3. Create complaints from the user account");
    console.log("4. Login as admin (admin@techflow.com) to see and assign complaints");
    console.log("5. Assign complaints to staff (jane.wilson@techflow.com)\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

createTestUser();
