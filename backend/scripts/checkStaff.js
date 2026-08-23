const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const User = require("../models/User");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const checkStaff = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const staffCount = await User.countDocuments({ role: "staff" });
    console.log(`Staff count: ${staffCount}`);

    const allUsers = await User.find({}, "name email role");
    console.log("All users:", allUsers);

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

checkStaff();
