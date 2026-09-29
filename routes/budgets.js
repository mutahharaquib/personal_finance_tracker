const express = require("express");
const budgets = require("../controllers/budgetController");
const { requireLogin } = require("../middlewares/auth");

const router = express.Router();
router.use(requireLogin);

router.get("/", budgets.index);
router.post("/", budgets.save);
router.post("/overall", budgets.setOverall);
router.post("/:id/delete", budgets.remove);

module.exports = router;
