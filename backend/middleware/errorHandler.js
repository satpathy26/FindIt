module.exports = function errorHandler(error, req, res, next) {
  // Log the server-side error for debugging, but never send its details to clients.
  console.error("Request failed:", error.message);
  if (res.headersSent) return next(error);
  return res.status(500).json({ message: "An unexpected server error occurred" });
};
