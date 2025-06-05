const bcrypt = require("bcrypt");
const User = require("../models/User");

exports.getRegister = (req, res) => res.render("register");

exports.registerUser = async (req, res) => {
    const { name, email, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ name, email, password: hashedPassword });
      await user.save();
      res.redirect("/auth/login");
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate email error
        res.render("error", { message: "Email already exists. Try logging in." });
      } else {
        console.error(err);
        res.render("error", { message: "Something went wrong. Please try again later." });
      }
    }
  };

exports.postRegister = async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ name, email, password: hashedPassword });
  await user.save();
  res.redirect("/auth/login");
};

exports.getLogin = (req, res) => res.render("login");

exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && (await bcrypt.compare(password, user.password))) {
    req.session.userId = user._id;
    res.redirect("/transactions");
  } else {
    res.send("Invalid credentials");
  }
};

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect("/auth/login");
};