const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const Item = require("../models/Item");
const { uploadDirectory } = require("../middleware/uploadMiddleware");

const allowedFields = ["title", "description", "type", "category", "location", "date"];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : value;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pageOptions(query) {
  const pageRaw = query.page ?? "1";
  const limitRaw = query.limit ?? "10";
  if (!/^\d+$/.test(String(pageRaw)) || Number(pageRaw) < 1) {
    return { error: "Page must be a positive whole number" };
  }
  if (!/^\d+$/.test(String(limitRaw)) || Number(limitRaw) < 1 || Number(limitRaw) > 50) {
    return { error: "Limit must be a whole number between 1 and 50" };
  }
  return { page: Number(pageRaw), limit: Number(limitRaw) };
}

function pagination(page, limit, totalItems) {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0
  };
}

function validationMessage(error) {
  const firstError = Object.values(error.errors || {})[0];
  return firstError?.message || "Please check the submitted item details";
}

function safeImagePath(file) {
  return `/uploads/${file.filename}`;
}

async function deleteImage(imagePath) {
  if (typeof imagePath !== "string") return;
  const filename = path.basename(imagePath);
  // Only remove our generated UUID filenames from the configured uploads folder.
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename)) return;
  const target = path.resolve(uploadDirectory, filename);
  if (path.dirname(target) !== uploadDirectory) return;
  try {
    await fs.unlink(target);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function hasValidImageSignature(file) {
  const handle = await fs.open(file.path, "r");
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const bytes = buffer.subarray(0, bytesRead);
    if (file.mimetype === "image/jpeg") {
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (file.mimetype === "image/png") {
      return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    if (file.mimetype === "image/webp") {
      return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    }
    return false;
  } finally {
    await handle.close();
  }
}

async function removeUploadedFile(file) {
  if (!file) return;
  await deleteImage(safeImagePath(file));
}

function validId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

async function getOwnedItem(req, res) {
  if (!validId(req.params.id)) {
    res.status(400).json({ message: "Item ID is invalid" });
    return null;
  }
  const item = await Item.findById(req.params.id);
  if (!item) {
    res.status(404).json({ message: "Item report not found" });
    return null;
  }
  if (!item.reporter.equals(req.user._id)) {
    res.status(403).json({ message: "You can only manage your own item reports" });
    return null;
  }
  return item;
}

exports.createItem = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "An item photo is required in the 'image' field" });
  }

  try {
    if (!(await hasValidImageSignature(req.file))) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ message: "The uploaded file is not a valid JPEG, PNG, or WebP image" });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const item = await Item.create({
      title: cleanString(body.title),
      description: cleanString(body.description),
      type: cleanString(body.type),
      category: cleanString(body.category),
      location: cleanString(body.location),
      date: body.date,
      image: safeImagePath(req.file),
      reporter: req.user._id
    });

    return res.status(201).json({ message: "Item report created", item });
  } catch (error) {
    await removeUploadedFile(req.file);
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: validationMessage(error) });
    }
    throw error;
  }
};

exports.listItems = async (req, res) => {
  const { type, category, search, status } = req.query;
  const options = pageOptions(req.query);
  if (options.error) return res.status(400).json({ message: options.error });
  if (type !== undefined && !["lost", "found"].includes(type)) {
    return res.status(400).json({ message: "Type filter must be lost or found" });
  }
  if (status !== undefined && !["active", "resolved"].includes(status)) {
    return res.status(400).json({ message: "Status filter must be active or resolved" });
  }
  if (category !== undefined && (typeof category !== "string" || !category.trim() || category.length > 60)) {
    return res.status(400).json({ message: "Category filter must be a non-empty string of at most 60 characters" });
  }
  if (search !== undefined && (typeof search !== "string" || search.trim().length > 100)) {
    return res.status(400).json({ message: "Search must be at most 100 characters" });
  }

  const filter = { status: status || "active" };
  if (type) filter.type = type;
  if (category) filter.category = category.trim().toLowerCase();
  if (search?.trim()) {
    const expression = new RegExp(escapeRegex(search.trim()), "i");
    filter.$or = [{ title: expression }, { description: expression }, { category: expression }, { location: expression }];
  }

  const [items, totalItems] = await Promise.all([
    Item.find(filter)
      .populate("reporter", "name")
      .sort({ createdAt: -1, _id: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit),
    Item.countDocuments(filter)
  ]);

  return res.status(200).json({ items, pagination: pagination(options.page, options.limit, totalItems) });
};

exports.getItem = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Item ID is invalid" });
  const item = await Item.findById(req.params.id).populate("reporter", "name");
  if (!item) return res.status(404).json({ message: "Item report not found" });
  return res.status(200).json({ item });
};

exports.getReporterContact = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Item ID is invalid" });

  const item = await Item.findById(req.params.id)
    .select("reporter status")
    .populate({ path: "reporter", select: "name email phone shareContact" });

  if (!item) return res.status(404).json({ message: "Item report not found" });
  if (item.status !== "active") {
    return res.status(409).json({ message: "This report is resolved, so contact sharing is no longer available" });
  }
  if (!item.reporter) return res.status(404).json({ message: "The reporter account is unavailable" });

  const isReporter = item.reporter._id.equals(req.user._id);
  if (!isReporter && item.reporter.shareContact !== true) {
    return res.status(403).json({ message: "The reporter has not enabled contact sharing" });
  }

  return res.status(200).json({
    contact: {
      name: item.reporter.name,
      email: item.reporter.email,
      phone: item.reporter.phone
    }
  });
};

exports.getMyItems = async (req, res) => {
  const options = pageOptions(req.query);
  if (options.error) return res.status(400).json({ message: options.error });
  const filter = { reporter: req.user._id };
  const [items, totalItems] = await Promise.all([
    Item.find(filter)
      .populate("reporter", "name")
      .sort({ createdAt: -1, _id: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit),
    Item.countDocuments(filter)
  ]);
  return res.status(200).json({ items, pagination: pagination(options.page, options.limit, totalItems) });
};

exports.updateItem = async (req, res) => {
  let item;
  try {
    item = await getOwnedItem(req, res);
  } catch (error) {
    await removeUploadedFile(req.file);
    throw error;
  }
  if (!item) {
    if (req.file) await removeUploadedFile(req.file);
    return;
  }

  const fields = {};
  const body = req.body && typeof req.body === "object" ? req.body : {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) fields[field] = cleanString(body[field]);
  }
  if (!req.file && Object.keys(fields).length === 0) {
    return res.status(400).json({ message: "Provide at least one item field or a replacement image" });
  }

  const previousImage = item.image;
  try {
    if (req.file) {
      if (!(await hasValidImageSignature(req.file))) {
        await removeUploadedFile(req.file);
        return res.status(400).json({ message: "The uploaded file is not a valid JPEG, PNG, or WebP image" });
      }
      item.image = safeImagePath(req.file);
    }
    Object.assign(item, fields);
    await item.save();
  } catch (error) {
    await removeUploadedFile(req.file);
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: validationMessage(error) });
    }
    throw error;
  }

  if (req.file) await deleteImage(previousImage);
  return res.status(200).json({ message: "Item report updated", item });
};

exports.resolveItem = async (req, res) => {
  const item = await getOwnedItem(req, res);
  if (!item) return;
  item.status = "resolved";
  await item.save();
  return res.status(200).json({ message: "Item report marked as resolved", item });
};

exports.reopenItem = async (req, res) => {
  const item = await getOwnedItem(req, res);
  if (!item) return;
  if (item.status !== "resolved") {
    return res.status(400).json({ message: "Only resolved reports can be reopened" });
  }
  item.status = "active";
  await item.save();
  return res.status(200).json({ message: "Item report reopened", item });
};

exports.deleteItem = async (req, res) => {
  const item = await getOwnedItem(req, res);
  if (!item) return;
  const image = item.image;
  await item.deleteOne();
  await deleteImage(image);
  return res.status(200).json({ message: "Item report deleted" });
};
