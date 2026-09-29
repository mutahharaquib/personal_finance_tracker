process.env.NODE_ENV = "test";

const mongoose = require("mongoose");
const request = require("supertest");
const createApp = require("../app");

let memoryServer = null;

// Uses TEST_MONGO_URI when provided (e.g. a local mongod), otherwise an
// in-memory MongoDB (set MONGOMS_SYSTEM_BINARY to reuse an installed mongod).
async function startDB() {
  let uri = process.env.TEST_MONGO_URI;
  if (!uri) {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  await mongoose.connect(uri, { dbName: `fintrac_test_${process.pid}` });
  await mongoose.connection.dropDatabase();
  return createApp({ sessionSecret: "test-secret" }); // default in-memory session store
}

async function stopDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

function csrfFrom(html) {
  const m = html.match(/name="_csrf" value="([a-f0-9]+)"/);
  if (!m) throw new Error("No CSRF token found on page");
  return m[1];
}

// A supertest agent that keeps cookies and knows its CSRF token.
async function agentFor(app) {
  const agent = request.agent(app);
  const res = await agent.get("/auth/login");
  agent.csrf = csrfFrom(res.text);
  agent.form = (url, body = {}) => agent.post(url).type("form").send({ _csrf: agent.csrf, ...body });
  return agent;
}

async function registeredAgent(app, overrides = {}) {
  const agent = await agentFor(app);
  const email = overrides.email || `user${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`;
  const res = await agent.form("/auth/register", {
    name: overrides.name || "Test User",
    email,
    password: "secret123",
    confirmPassword: "secret123",
  });
  if (res.headers.location !== "/dashboard") throw new Error(`Registration failed: ${res.headers.location}`);
  // Session was regenerated on sign-in, so fetch the new CSRF token.
  agent.csrf = csrfFrom((await agent.get("/dashboard")).text);
  agent.email = email;
  return agent;
}

function isoDaysAgo(n) {
  const d = new Date();
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - n));
  return utc.toISOString().slice(0, 10);
}

module.exports = { startDB, stopDB, agentFor, registeredAgent, csrfFrom, isoDaysAgo };
