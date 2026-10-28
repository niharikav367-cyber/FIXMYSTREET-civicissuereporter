// backend/server.js
// FixMyStreet Express API Server

const path = require("path");
// Ensure .env is loaded regardless of execution root
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const reportsRouter = require("./routes/reports");

const app = express();
const port = Number(process.env.PORT || 3000);

// Disable Express fingerprinting
app.disable("x-powered-by");

// Basic security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Allows inline scripts/styles for student SPA
  })
);

// Standard CORS handling for development, API clients, and browsers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, x-admin-key"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// JSON and URL-encoded request body parsing (up to 5MB for photo payloads)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// General rate limiter on all /api routes (100 requests per 15 mins per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests from this IP, please try again after 15 minutes.",
  },
});
app.use("/api", apiLimiter);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FixMyStreet API is healthy and operational.",
    timestamp: new Date().toISOString(),
  });
});

// Mount the civic reports router
app.use("/api/reports", reportsRouter);

// Serve frontend static assets
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

// Fallback route for Single Page Application navigation
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(frontendPath, "index.html"), (err) => {
      if (err && !res.headersSent) {
        res.status(500).send("Error loading FixMyStreet frontend.");
      }
    });
  }
  next();
});

// Centralized 404 handler for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Server Error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    error: "An unexpected server error occurred. Please try again later.",
  });
});

// Start listening if run directly
if (require.main === module) {
  app.listen(port, () => {
    console.log(`FixMyStreet server running at http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/api/health`);
  });
}

module.exports = app;
