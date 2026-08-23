const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const Category = require("../models/Category");

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

const seedComplaints = async () => {
  try {
    await connectDB();

    const count = await Complaint.countDocuments();
    if (count > 0) {
      console.log("Complaints already exist. Skipping seed...");
      // process.exit();
    }

    // Get users and categories
    const users = await User.find({ role: "user" });
    const staff = await User.find({ role: "staff" });
    const categories = await Category.find({});

    if (users.length === 0 || categories.length === 0) {
      console.log("Users or Categories missing. Cannot seed complaints.");
      process.exit(1);
    }

    const complaints = [
      {
        title: "Internet connectivity issue",
        description:
          "Unable to connect to Wi-Fi in the conference room. It has been down for 2 hours.",
        category:
          categories.find((c) => c.name === "IT Support")?._id ||
          categories[0]._id,
        priority: "high",
        status: "new",
        user: users[0]._id,
        complaintId: "TKT-1001",
      },
      {
        title: "Leaking faucet in restroom",
        description:
          "The faucet in the 2nd floor men's restroom is leaking constantly.",
        category:
          categories.find((c) => c.name === "Maintenance")?._id ||
          categories[0]._id,
        priority: "medium",
        status: "assigned",
        user: users[1] ? users[1]._id : users[0]._id,
        assignedTo: staff[0]?._id,
        complaintId: "TKT-1002",
      },
      {
        title: "Payroll discrepancy",
        description: "My salary for this month seems to be incorrect.",
        category:
          categories.find((c) => c.name === "Human Resources")?._id ||
          categories[0]._id,
        priority: "critical",
        status: "in-progress",
        user: users[0]._id,
        assignedTo: staff[1]?._id,
        complaintId: "TKT-1003",
      },
      {
        title: "Broken Chair",
        description: "My office chair wheel is broken.",
        category:
          categories.find((c) => c.name === "IT Support")?._id ||
          categories[0]._id,
        priority: "low",
        status: "resolved",
        user: users[0]._id,
        assignedTo: staff[0]?._id,
        complaintId: "TKT-1004",
        timeline: {
          submittedAt: new Date(Date.now() - 86400000 * 3),
          resolvedAt: new Date(),
        },
      },
    ];

    for (const data of complaints) {
      const exists = await Complaint.findOne({ complaintId: data.complaintId });
      if (!exists) {
        await Complaint.create(data);
        console.log(`Created complaint: ${data.complaintId}`);
      } else {
        console.log(`Complaint exists: ${data.complaintId}`);
      }
    }

    console.log("Complaints Seeded!");
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedComplaints();
