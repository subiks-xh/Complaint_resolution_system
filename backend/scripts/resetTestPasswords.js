/* eslint-disable no-console */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const User = require("../models/User");
const Organization = require("../models/Organization");

const accountsToReset = [
  { email: "it.staff@example.com", password: "password123" },
  { email: "john@example.com", password: "password123" },
  { email: "qa.staff@local.test", password: "password123" },
  { email: "qa.user@local.test", password: "password123" },
];

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);

  let defaultOrg = await Organization.findOne({ code: "ORG-DEFAULT" });
  if (!defaultOrg) {
    defaultOrg = await Organization.create({
      name: "Default Organization",
      code: "ORG-DEFAULT",
      email: "org@example.com",
    });
    console.log("CREATED ORG ORG-DEFAULT");
  }

  for (const account of accountsToReset) {
    // eslint-disable-next-line no-await-in-loop
    const user = await User.findOne({ email: account.email }).select("+password");
    if (!user) {
      console.log(`SKIP ${account.email} (not found)`);
      continue;
    }

    user.password = account.password;
    user.isActive = true;
    user.isEmailVerified = true;
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    if (user.role !== "super_admin" && !user.organization) {
      user.organization = defaultOrg._id;
    }

    // eslint-disable-next-line no-await-in-loop
    await user.save();
    console.log(`RESET ${account.email} (${user.role})`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
