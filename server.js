require("dotenv").config();

const crypto = require("crypto");
const mongoose = require("mongoose");
const { MongoStore } = require("connect-mongo");
const connectDB = require("./config/db");
const createApp = require("./app");

async function main() {
  let sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production.");
    }
    sessionSecret = crypto.randomBytes(32).toString("hex");
    console.warn("SESSION_SECRET not set — using a random one (sessions reset on restart).");
  }

  await connectDB(process.env.MONGO_URI);

  const sessionStore = MongoStore.create({
    client: mongoose.connection.getClient(),
    collectionName: "sessions",
    ttl: 60 * 60 * 24 * 14,
  });

  const app = createApp({ sessionStore, sessionSecret });
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`FinTrac running on http://localhost:${port}`));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
