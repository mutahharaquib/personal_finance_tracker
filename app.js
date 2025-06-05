const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const dotenv = require("dotenv");
const path = require("path");
const port = process.env.PORT || 3000;

dotenv.config();
const app = express();

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => console.log(err));
  
// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// Routes
const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");

app.use("/auth", authRoutes);
app.use("/transactions", transactionRoutes);

// Home route
app.get("/", (req, res) => {
  res.render("index");
});

app.listen(port, () =>
    console.log("Server started on http://localhost:3000")
);