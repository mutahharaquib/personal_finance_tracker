const express = require("express");
const { rateLimit } = require("express-rate-limit");
const auth = require("../controllers/authController");
const { guestOnly, requireLogin } = require("../middlewares/auth");

const router = express.Router();

// Slow down password guessing and signup spam.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  handler: (req, res) => {
    req.flash("error", "Too many attempts. Please wait a few minutes and try again.");
    res.redirect(req.originalUrl);
  },
});

router.get("/login", guestOnly, auth.getLogin);
router.post("/login", guestOnly, authLimiter, auth.postLogin);
router.get("/register", guestOnly, auth.getRegister);
router.post("/register", guestOnly, authLimiter, auth.postRegister);
router.get("/forgot", guestOnly, auth.getForgot);
router.post("/forgot", guestOnly, authLimiter, auth.postForgot);
router.get("/reset/:token", guestOnly, auth.getReset);
router.post("/reset/:token", guestOnly, authLimiter, auth.postReset);
router.post("/logout", requireLogin, auth.logout);

module.exports = router;
