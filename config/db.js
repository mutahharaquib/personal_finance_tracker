const mongoose = require("mongoose");

async function connectDB(uri) {
  if (!uri) {
    throw new Error("MONGO_URI is not set. Copy .env.example to .env and fill it in.");
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log(`MongoDB connected (${mongoose.connection.name})`);
  return mongoose.connection;
}

module.exports = connectDB;
