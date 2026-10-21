const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [2, "Title must be at least 2 characters long"],
      maxlength: [120, "Title cannot be longer than 120 characters"]
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: [5, "Description must be at least 5 characters long"],
      maxlength: [2000, "Description cannot be longer than 2000 characters"]
    },
    type: {
      type: String,
      required: [true, "Report type is required"],
      enum: { values: ["lost", "found"], message: "Type must be lost or found" },
      lowercase: true,
      trim: true
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      lowercase: true,
      maxlength: [60, "Category cannot be longer than 60 characters"]
    },
    location: {
      type: String,
      required: [true, "Campus location is required"],
      trim: true,
      maxlength: [160, "Location cannot be longer than 160 characters"]
    },
    date: {
      type: Date,
      required: [true, "Date of loss or discovery is required"],
      validate: {
        validator: (value) => value instanceof Date && !Number.isNaN(value.getTime()),
        message: "Enter a valid date"
      }
    },
    image: {
      type: String,
      required: [true, "An item photo is required"]
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reporter is required"]
    },
    status: {
      type: String,
      enum: { values: ["active", "resolved"], message: "Status must be active or resolved" },
      default: "active",
      lowercase: true
    }
  },
  { timestamps: true }
);

itemSchema.index({ status: 1, createdAt: -1 });
itemSchema.index({ reporter: 1, createdAt: -1 });
itemSchema.index({ type: 1, category: 1, status: 1 });

module.exports = mongoose.model("Item", itemSchema);
