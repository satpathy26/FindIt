const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

module.exports = async function authenticate(req, res, next) {
  const authorization = req.get("Authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication required. Provide a valid Bearer token." });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "Authentication is not configured on the server" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!mongoose.isValidObjectId(payload.userId)) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ message: "Invalid or expired token" });

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
