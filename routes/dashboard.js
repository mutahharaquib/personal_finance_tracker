const express = require("express");
const dashboard = require("../controllers/dashboardController");
const { requireLogin } = require("../middlewares/auth");

const router = express.Router();

router.get("/", requireLogin, dashboard.show);

module.exports = router;
