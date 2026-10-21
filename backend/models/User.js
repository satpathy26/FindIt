const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [80, "Name cannot be longer than 80 characters"]
    },
    rollNo: {
      type: String,
      required: [true, "College roll number is required"],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [40, "College roll number cannot be longer than 40 characters"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [254, "Email cannot be longer than 254 characters"],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"]
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[+\d][\d\s().-]{6,19}$/, "Enter a valid phone number"]
    },
    shareContact: {
      type: Boolean,
      default: false
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
      select: false
    }
  },
  { timestamps: true }
);

// Hash only when a new password is set; unrelated user edits must not rehash it.
userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

module.exports = mongoose.model("User", userSchema);
