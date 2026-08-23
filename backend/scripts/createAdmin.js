#!/usr/bin/env node
/**
 * createAdmin.js
 *
 * Creates or promotes a user to `org_admin` in the local MongoDB using the
 * project's `User` model so password hashing and validation run normally.
 *
 * Usage: from repository root run `node backend/scripts/createAdmin.js`
 *
 * NOTE: This script connects to the database configured in backend/.env
 */

const path = require("path");
const dotenv = require("dotenv");

// Load backend .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/complaint_system";

async function main() {
  try {
    console.log("Connecting to database:", MONGODB_URI);
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const User = require("../models/User");
    const Organization = require("../models/Organization");

    // Default credentials (change after creation)
    const email = process.env.CREATE_ADMIN_EMAIL || "admin@example.com";
    const password = process.env.CREATE_ADMIN_PASSWORD || "AdminPass1!";
    const name = process.env.CREATE_ADMIN_NAME || "Administrator";
    const orgCode = process.env.CREATE_ADMIN_ORG_CODE || "ORG-DEFAULT";

    let organization = await Organization.findOne({ code: orgCode });
    if (!organization) {
      organization = await Organization.create({
        name: process.env.CREATE_ADMIN_ORG_NAME || "Default Organization",
        code: orgCode,
        email: process.env.CREATE_ADMIN_ORG_EMAIL || "org@example.com",
      });
      console.log(`Created default organization (${organization.code})`);
    }

    // Check if a user with this email exists
    let user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (user) {
      // Promote to org admin and reset password
      user.role = "org_admin";
      user.organization = user.organization || organization._id;
      user.isEmailVerified = true;
      user.password = password; // pre-save hook will hash
      await user.save();
      console.log(`Updated existing user (${email}) -> role: org_admin`);
    } else {
      // Create new org admin user
      user = await User.create({
        name,
        email: email.toLowerCase(),
        password,
        role: "org_admin",
        organization: organization._id,
        isEmailVerified: true,
      });
      console.log(`Created new org admin user: ${email}`);
    }

    console.log("");
    console.log("ADMIN CREDENTIALS:");
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Role: org_admin`);
    console.log(`  Organization: ${organization.name} (${organization.code})`);
    console.log("");
    console.log("Please change the password after first login.");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error creating admin:", err);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

main();
