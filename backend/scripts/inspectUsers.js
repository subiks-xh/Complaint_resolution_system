/* eslint-disable no-console */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const User = require("../models/User");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri);

  const emails = process.argv.slice(2);
  const filter = emails.length ? { email: { $in: emails.map((e) => e.toLowerCase()) } } : {};

  const users = await User.find(filter)
    .select("email role isActive organization loginAttempts lockUntil isEmailVerified")
    .lean();

  console.log(JSON.stringify(users, null, 2));
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
