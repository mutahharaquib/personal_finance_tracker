const express = require("express");
const settings = require("../controllers/settingsController");
const { requireLogin } = require("../middlewares/auth");

const router = express.Router();
router.use(requireLogin);

router.get("/", settings.index);
router.post("/profile", settings.updateProfile);
router.post("/password", settings.changePassword);
router.post("/categories", settings.addCategory);
router.post("/categories/:id/delete", settings.deleteCategory);
router.post("/delete-account", settings.deleteAccount);

module.exports = router;
