const express = require("express");
const itemController = require("../controllers/itemController");
const authenticate = require("../middleware/authMiddleware");
const { uploadImage } = require("../middleware/uploadMiddleware");

const router = express.Router();

// Keep /my ahead of /:id so it is treated as a named route.
router.get("/my", authenticate, itemController.getMyItems);
router.post("/", authenticate, uploadImage, itemController.createItem);
router.get("/", itemController.listItems);
router.get("/:id/contact", authenticate, itemController.getReporterContact);
router.patch("/:id/resolve", authenticate, itemController.resolveItem);
router.patch("/:id/reopen", authenticate, itemController.reopenItem);
router.patch("/:id", authenticate, uploadImage, itemController.updateItem);
router.delete("/:id", authenticate, itemController.deleteItem);
router.get("/:id", itemController.getItem);

module.exports = router;
