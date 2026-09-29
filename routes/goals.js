const express = require("express");
const goals = require("../controllers/goalController");
const { requireLogin } = require("../middlewares/auth");

const router = express.Router();
router.use(requireLogin);

router.get("/", goals.index);
router.post("/", goals.create);
router.post("/:id", goals.update);
router.post("/:id/contribute", goals.contribute);
router.post("/:id/delete", goals.remove);

module.exports = router;
