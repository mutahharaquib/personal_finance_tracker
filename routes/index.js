const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/dashboard");
  res.render("index", { title: "FinTrac — Personal finance, made simple" });
});

module.exports = router;
