// backend/middleware/auth.js
// Verifies the administrator API key passed in the 'x-admin-key' header.

function requireAdmin(req, res, next) {
  const adminKey = req.headers["x-admin-key"];
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    console.error("ADMIN_API_KEY is not configured in backend/.env");
    return res.status(500).json({
      success: false,
      error: "Admin authentication is not configured on the server.",
    });
  }

  if (!adminKey || adminKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid or missing administrator API key.",
    });
  }

  next();
}

module.exports = { requireAdmin };
