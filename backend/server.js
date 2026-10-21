
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const mongoose = require("mongoose");
const path = require("node:path");
const authRoutes = require("./routes/authRoutes");
const itemRoutes = require("./routes/itemRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5500,http://127.0.0.1:5500")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Non-browser tools such as curl do not send Origin and remain usable for development.
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "16kb" }));
app.use("/uploads", express.static(path.resolve(__dirname, "uploads"), { dotfiles: "deny", index: false }));
app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);

app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "unavailable",
    message: "FindIt API is running",
    database: databaseConnected ? "connected" : "disconnected"
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to FindIt API",
    status: "running"
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 8000;

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`FindIt server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Could not start FindIt:", error.message);
    process.exit(1);
  }
}

// Importing the app in tests should not start a second server or database connection.
if (require.main === module) {
  startServer();
}

module.exports = app;
