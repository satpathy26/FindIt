const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function safeProfile(user) {
  return {
    id: user._id,
    name: user.name,
    rollNo: user.rollNo,
    email: user.email,
    phone: user.phone,
    shareContact: user.shareContact,
    createdAt: user.createdAt
  };
}

function duplicateFieldMessage(error) {
  const field = Object.keys(error.keyPattern || {})[0];
  if (field === "email") return "An account with this email already exists";
  if (field === "rollNo") return "An account with this college roll number already exists";
  return "An account with these details already exists";
}

function validationMessage(error) {
  const messages = Object.values(error.errors || {}).map((item) => item.message);
  return messages[0] || "Please check the submitted details";
}

exports.register = async (req, res) => {
  const { name, rollNo, email, phone, password } = req.body || {};

  if (![name, rollNo, email, phone, password].every(
    (value) => typeof value === "string" && value.trim().length > 0
  )) {
    return res.status(400).json({ message: "Name, roll number, email, phone, and password are required" });
  }

  try {
    const user = await User.create({ name, rollNo, email, phone, password });
    return res.status(201).json({ message: "Account created successfully", user: safeProfile(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: duplicateFieldMessage(error) });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: validationMessage(error) });
    }
    throw error;
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");
  const passwordMatches = user && await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "Authentication is not configured on the server" });
  }

  const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
  return res.status(200).json({ message: "Login successful", token, user: safeProfile(user) });
};

exports.me = (req, res) => res.status(200).json({ user: safeProfile(req.user) });

exports.updateContactSharing = async (req, res) => {
  if (typeof req.body?.shareContact !== "boolean") {
    return res.status(400).json({ message: "shareContact must be true or false" });
  }

  req.user.shareContact = req.body.shareContact;
  await req.user.save();

  return res.status(200).json({
    message: req.user.shareContact ? "Contact sharing enabled" : "Contact sharing disabled",
    user: { id: req.user._id, shareContact: req.user.shareContact }
  });
};
