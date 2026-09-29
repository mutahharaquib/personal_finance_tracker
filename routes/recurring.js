const express = require("express");
const recurring = require("../controllers/recurringController");
const { requireLogin } = require("../middlewares/auth");

const router = express.Router();
router.use(requireLogin);

router.get("/", recurring.index);
router.post("/", recurring.create);
router.post("/:id/toggle", recurring.toggle);
router.post("/:id/delete", recurring.remove);

module.exports = router;
