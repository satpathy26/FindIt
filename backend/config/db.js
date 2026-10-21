
const mongoose = require("mongoose");

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing. Add it to the root .env file.");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected successfully");
}

module.exports = connectDB;
