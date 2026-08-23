const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const User = require("../models/User");
const Organization = require("../models/Organization");

// Load backend .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const importData = async () => {
  try {
    await connectDB();

    let defaultOrg = await Organization.findOne({ code: "ORG-DEFAULT" });
    if (!defaultOrg) {
      defaultOrg = await Organization.create({
        name: "Default Organization",
        code: "ORG-DEFAULT",
        email: "org@example.com",
      });
      console.log("Created default organization: ORG-DEFAULT");
    }

    // Check if users already exist
    // const count = await User.countDocuments();
    // if (count > 0) {
    //     console.log("Users already exist. Skipping seed...");
    //     // Optionally clear users: await User.deleteMany();
    //      process.exit();
    // }

    const users = [
      // Admin
      {
        name: "Admin User",
        email: "admin@example.com",
        password: "password123",
        role: "org_admin",
        organization: defaultOrg._id,
        isEmailVerified: true,
        department: "Administration",
        designation: "System Administrator",
      },
      // Staff
      {
        name: "IT Support Staff",
        email: "it.staff@example.com",
        password: "password123",
        role: "staff",
        organization: defaultOrg._id,
        isEmailVerified: true,
        department: "IT Department",
        designation: "IT Support Specialist",
        maxAssignedComplaints: 20,
      },
      {
        name: "HR Staff",
        email: "hr.staff@example.com",
        password: "password123",
        role: "staff",
        organization: defaultOrg._id,
        isEmailVerified: true,
        department: "HR",
        designation: "HR Executive",
        maxAssignedComplaints: 15,
      },
      // Users
      {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        role: "user",
        organization: defaultOrg._id,
        isEmailVerified: true,
        department: "Sales",
        designation: "Sales Executive",
      },
      {
        name: "Jane Smith",
        email: "jane@example.com",
        password: "password123",
        role: "user",
        organization: defaultOrg._id,
        isEmailVerified: true,
        department: "Marketing",
        designation: "Marketing Manager",
      },
    ];

    // Has passwords will be handled by pre-save middleware in User model
    // However, User.insertMany might bypass middleware depending on mongoose version/config.
    // It's safer to use create() or save() in a loop to ensure middleware runs (hashing password).

    console.log("Seeding users...");

    for (const user of users) {
      const exists = await User.findOne({ email: user.email });
      if (!exists) {
        await User.create(user);
        console.log(`Created user: ${user.email} (${user.role})`);
      } else {
        console.log(`User already exists: ${user.email}`);
      }
    }

    console.log("Users Seeded/Verified Successfully!");
    process.exit();
  } catch (error) {
    console.error(`Error with data import: ${error}`);
    process.exit(1);
  }
};

importData();
