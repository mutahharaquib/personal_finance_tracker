const express = require("express");
const tx = require("../controllers/transactionController");
const { requireLogin } = require("../middlewares/auth");

const router = express.Router();
router.use(requireLogin);

router.get("/", tx.list);
router.get("/export", tx.exportCSV);
router.post("/", tx.create);
router.post("/import", tx.importCSV);
router.post("/:id", tx.update);
router.post("/:id/delete", tx.remove);

module.exports = router;
