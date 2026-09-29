const mongoose = require("mongoose");

async function connectDB(uri) {
  if (!uri) {
    throw new Error("MONGO_URI is not set. Copy .env.example to .env and fill it in.");
  }
  mongoose.set("strictQuery", true);
  try {
    // Fail fast instead of hanging for 30s when the database is unreachable.
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  } catch (err) {
    const host = uri.replace(/\/\/[^@]*@/, "//***@").split("?")[0];
    let hint = "Check that MongoDB is running and MONGO_URI is correct.";
    if (/querySrv|ENOTFOUND/.test(err.message)) {
      hint = "The cluster address couldn't be found. If it's a MongoDB Atlas cluster, check it still exists in the Atlas dashboard (free clusters are removed after long inactivity) and copy a fresh connection string.";
    } else if (/auth/i.test(err.message)) {
      hint = "The database username or password in MONGO_URI was rejected.";
    } else if (/whitelist|IP|timed out|Server selection/i.test(err.message)) {
      hint = "The server didn't respond. For Atlas, add your IP under Network Access.";
    }
    throw new Error(`Could not connect to MongoDB at ${host}\n  ${err.message}\n  → ${hint}`);
  }
  console.log(`MongoDB connected (${mongoose.connection.name})`);
  return mongoose.connection;
}

module.exports = connectDB;
