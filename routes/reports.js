const express = require("express");
const reports = require("../controllers/reportController");
const { requireLogin } = require("../middlewares/auth");

const router = express.Router();

router.get("/", requireLogin, reports.index);

module.exports = router;
