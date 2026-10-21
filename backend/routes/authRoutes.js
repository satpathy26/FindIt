const express = require("express");
const authController = require("../controllers/authController");
const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);
router.patch("/contact-sharing", authenticate, authController.updateContactSharing);

module.exports = router;
