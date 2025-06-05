const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.get("/register", authController.getRegister);
// router.post("/register", authController.postRegister); // Updated to use registerUser method
router.post("/register", authController.registerUser);
router.get("/login", authController.getLogin);
router.post("/login", authController.postLogin);
router.get("/logout", authController.logout);

module.exports = router;

// const express = require("express");
// const router = express.Router();
// const bcrypt = require("bcrypt");
// const User = require("../models/User");

// // Register
// router.get("/register", (req, res) => {
//   res.render("register");
// });

// router.post("/register", async (req, res) => {
//   const { name, email, password } = req.body;
//   const hashedPassword = await bcrypt.hash(password, 10);
//   const user = new User({ name, email, password: hashedPassword });
//   await user.save();
//   res.redirect("/auth/login");
// });

// // Login
// router.get("/login", (req, res) => {
//   res.render("login");
// });

// router.post("/login", async (req, res) => {
//   const { email, password } = req.body;
//   const user = await User.findOne({ email });
//   if (user && (await bcrypt.compare(password, user.password))) {
//     req.session.userId = user._id;
//     res.redirect("/transactions");
//   } else {
//     res.send("Invalid credentials");
//   }
// });

// // Logout
// router.get("/logout", (req, res) => {
//   req.session.destroy();
//   res.redirect("/auth/login");
// });

// module.exports = router;