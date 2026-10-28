// backend/routes/reports.js
// Express router handling civic issue reports for citizens and administrators.

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { supabase } = require("../supabase");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// In-memory cache for admin notes when database table does not yet have admin_notes column
const adminNotesFallbackCache = new Map([
  ["FSM-A1B2C3D4", "Assigned to Ward 4 Road Maintenance crew. Asphalt patch work scheduled."],
  ["FSM-E5F6G7H8", "Sanitation supervisor alerted. Secondary compactor vehicle dispatched."],
  ["FSM-J9K0L1M2", "Electrician replaced damaged LED fixture and underground wiring on 26 Oct."]
]);

// Configure Multer for optional image upload in memory (3 MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, WebP) are allowed."), false);
    }
  },
});

const allowedCategories = [
  "Roads & footpaths",
  "Garbage & sanitation",
  "Water & utilities",
  "Municipal services",
  "Public safety",
  "Harassment or sexual offence",
  "Pollution & noise",
  "Other civic complaint",
];

const allowedPriorities = ["Normal", "High", "Urgent"];

const allowedStatuses = [
  "Submitted",
  "Under review",
  "In progress",
  "Resolved",
  "Rejected",
];

// Helper to send standard error responses
function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    error: message,
  });
}

// Helper to determine if a string is a standard UUID
function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str || ""));
}

// Helper to normalize report object with fallback fields
function normalizeReport(r) {
  if (!r) return null;
  const admin_notes = r.admin_notes !== undefined && r.admin_notes !== null
    ? r.admin_notes
    : (adminNotesFallbackCache.get(r.reference_id) || null);
  const evidence_url = r.evidence_url || r.evidence_path || null;
  return {
    ...r,
    admin_notes,
    evidence_url,
    evidence_path: r.evidence_path || r.evidence_url || null,
  };
}

// -------------------------------------------------------------
// 1. GET /api/reports/stats - Summary counts for platform banner
// -------------------------------------------------------------
router.get("/stats", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("status, sensitive");

    if (error) {
      console.error("STATS ERROR:", error);
      return sendError(res, 500, "Could not fetch report statistics.");
    }

    const reports = data || [];
    const stats = {
      total: reports.length,
      underReview: reports.filter((r) => r.status === "Under review").length,
      inProgress: reports.filter((r) => r.status === "In progress").length,
      resolved: reports.filter((r) => r.status === "Resolved").length,
    };

    return res.status(200).json({
      success: true,
      stats,
    });
  } catch (err) {
    console.error("GET STATS ERROR:", err);
    return sendError(res, 500, "Internal server error fetching statistics.");
  }
});

// -------------------------------------------------------------
// 2. GET /api/reports/track/:referenceId - Citizen status lookup
// -------------------------------------------------------------
router.get("/track/:referenceId", async (req, res) => {
  try {
    const referenceId = String(req.params.referenceId || "").trim().toUpperCase();

    if (!referenceId || !/^FSM-[A-Z0-9]{8}$/.test(referenceId)) {
      return sendError(
        res,
        400,
        "Please provide a valid reference ID in the format FSM-XXXXXXXX."
      );
    }

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("reference_id", referenceId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return sendError(
          res,
          404,
          `No report found with reference ID "${referenceId}". Please verify and try again.`
        );
      }
      console.error("TRACK REPORT DB ERROR:", error);
      return sendError(res, 500, `Database error: ${error.message}`);
    }

    if (!data) {
      return sendError(
        res,
        404,
        `No report found with reference ID "${referenceId}". Please verify and try again.`
      );
    }

    return res.status(200).json({
      success: true,
      report: normalizeReport(data),
    });
  } catch (err) {
    console.error("TRACK REPORT ERROR:", err);
    return sendError(res, 500, "Server error looking up report.");
  }
});

// -------------------------------------------------------------
// 3. GET /api/reports - Public feed of non-sensitive reports
// -------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    let query = supabase
      .from("reports")
      .select("*")
      .eq("sensitive", false)
      .order("created_at", { ascending: false });

    const { category, status, search } = req.query;

    if (category && allowedCategories.includes(category)) {
      query = query.eq("category", category);
    }

    if (status && allowedStatuses.includes(status)) {
      query = query.eq("status", status);
    }

    if (search && String(search).trim()) {
      // Clean query string against PostgREST syntax injection
      const term = String(search).trim().replace(/[,%()."\\*]/g, "");
      if (term) {
        query = query.or(
          `title.ilike.%${term}%,area.ilike.%${term}%,description.ilike.%${term}%`
        );
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("SUPABASE GET REPORTS ERROR:", error);
      return sendError(res, 500, `Database query failed: ${error.message}`);
    }

    const reports = (data || []).map(normalizeReport);

    return res.status(200).json({
      success: true,
      reports,
    });
  } catch (err) {
    console.error("GET REPORTS ERROR:", err);
    return sendError(res, 500, "Could not load public reports.");
  }
});

// -------------------------------------------------------------
// 4. POST /api/reports - Submit a new civic issue report
// -------------------------------------------------------------
router.post("/", upload.single("photo"), async (req, res) => {
  try {
    const body = req.body || {};

    const category = String(body.category || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const area = String(body.area || "").trim();
    const address = String(body.address || "").trim();
    const priority = String(body.priority || "Normal").trim();
    const reporterName = String(body.reporter_name || body.reporter || "").trim();
    const contact = String(body.contact || "").trim();

    const sensitive = category === "Harassment or sexual offence";

    // Validations
    if (!allowedCategories.includes(category)) {
      return sendError(res, 400, "Please select a valid issue category.");
    }

    if (title.length < 4 || title.length > 120) {
      return sendError(res, 400, "Title must contain between 4 and 120 characters.");
    }

    if (description.length < 10 || description.length > 3000) {
      return sendError(
        res,
        400,
        "Description must contain between 10 and 3000 characters."
      );
    }

    if (!area || area.length > 160) {
      return sendError(res, 400, "Please enter a valid area or locality name.");
    }

    if (address && address.length > 250) {
      return sendError(res, 400, "Landmark / address must be 250 characters or fewer.");
    }

    if (!allowedPriorities.includes(priority)) {
      return sendError(res, 400, "Please select a valid priority level.");
    }

    if (contact && !/^[0-9+\-\s()]{7,20}$/.test(contact)) {
      return sendError(
        res,
        400,
        "Please provide a valid contact number (7 to 20 digits)."
      );
    }

    // Photo processing (Data URL)
    let photoDataUrl = null;
    if (req.file && req.file.buffer) {
      const mime = req.file.mimetype || "image/jpeg";
      photoDataUrl = `data:${mime};base64,${req.file.buffer.toString("base64")}`;
    } else if (body.evidence_url && String(body.evidence_url).startsWith("data:image/")) {
      photoDataUrl = String(body.evidence_url);
    }

    // Generate unique reference ID
    const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    const referenceId = `FSM-${randomHex}`;

    const newReport = {
      reference_id: referenceId,
      category,
      title,
      description,
      area,
      address: address || null,
      priority,
      status: "Submitted",
      sensitive,
      reporter_name: reporterName || null,
      contact: contact || null,
    };

    if (photoDataUrl) {
      // Store in evidence_path (the column existing in Supabase)
      newReport.evidence_path = photoDataUrl;
    }

    let { data, error } = await supabase
      .from("reports")
      .insert([newReport])
      .select()
      .single();

    // If insertion failed because evidence_path wasn't found, try with evidence_url
    if (error && error.code === "PGRST204" && photoDataUrl) {
      delete newReport.evidence_path;
      newReport.evidence_url = photoDataUrl;
      const retry = await supabase.from("reports").insert([newReport]).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("SUPABASE INSERT ERROR:", error);
      return sendError(res, 500, `Database save failed: ${error.message}`);
    }

    return res.status(201).json({
      success: true,
      message: "Report submitted successfully.",
      reference_id: data.reference_id,
      sensitive: data.sensitive,
      report: normalizeReport(data),
    });
  } catch (err) {
    console.error("POST REPORT ERROR:", err);
    return sendError(res, 500, err.message || "Unexpected error while saving report.");
  }
});

// -------------------------------------------------------------
// 5. GET /api/reports/admin - List all reports for municipal staff
// -------------------------------------------------------------
router.get("/admin", requireAdmin, async (req, res) => {
  try {
    const { category, status, search } = req.query;

    let query = supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (category && allowedCategories.includes(category)) {
      query = query.eq("category", category);
    }

    if (status && allowedStatuses.includes(status)) {
      query = query.eq("status", status);
    }

    if (search && String(search).trim()) {
      const term = String(search).trim().replace(/[,%()."\\*]/g, "");
      if (term) {
        query = query.or(
          `title.ilike.%${term}%,area.ilike.%${term}%,reference_id.ilike.%${term}%`
        );
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("ADMIN GET REPORTS ERROR:", error);
      return sendError(res, 500, `Database error: ${error.message}`);
    }

    const reports = (data || []).map(normalizeReport);

    return res.status(200).json({
      success: true,
      reports,
    });
  } catch (err) {
    console.error("ADMIN GET REPORTS EXCEPTION:", err);
    return sendError(res, 500, "Failed to fetch administrator reports.");
  }
});

// -------------------------------------------------------------
// 6. PATCH /api/reports/:id/status - Update issue status & notes
// -------------------------------------------------------------
router.patch("/:id/status", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body || {};

    if (!allowedStatuses.includes(status)) {
      return sendError(
        res,
        400,
        `Invalid status. Allowed values: ${allowedStatuses.join(", ")}`
      );
    }

    const updates = {
      status,
      updated_at: new Date().toISOString(),
    };

    const trimmedNotes = typeof admin_notes === "string" ? admin_notes.trim() : null;
    if (trimmedNotes !== null) {
      updates.admin_notes = trimmedNotes;
    }

    // Support updating by UUID or by reference_id (FSM-XXXXXXXX)
    const filterColumn = isUUID(id) ? "id" : "reference_id";

    let { data, error } = await supabase
      .from("reports")
      .update(updates)
      .eq(filterColumn, id)
      .select()
      .single();

    // If update failed because 'admin_notes' column does not exist in schema cache
    if (error && (error.code === "PGRST204" || error.code === "42703") && updates.admin_notes !== undefined) {
      delete updates.admin_notes;
      const retry = await supabase
        .from("reports")
        .update(updates)
        .eq(filterColumn, id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === "PGRST116") {
        return sendError(res, 404, "Report not found.");
      }
      console.error("UPDATE STATUS ERROR:", error);
      return sendError(res, 500, `Could not update report: ${error.message}`);
    }

    if (!data) {
      return sendError(res, 404, "Report not found.");
    }

    // Persist to notes cache for reference
    if (trimmedNotes !== null) {
      adminNotesFallbackCache.set(data.reference_id, trimmedNotes);
    }

    return res.status(200).json({
      success: true,
      message: `Report status updated to "${status}".`,
      report: normalizeReport(data),
    });
  } catch (err) {
    console.error("PATCH STATUS ERROR:", err);
    return sendError(res, 500, "Failed to update report status.");
  }
});

// -------------------------------------------------------------
// 7. DELETE /api/reports/:id - Delete spam or invalid report
// -------------------------------------------------------------
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const filterColumn = isUUID(id) ? "id" : "reference_id";

    const { data, error } = await supabase
      .from("reports")
      .delete()
      .eq(filterColumn, id)
      .select();

    if (error) {
      console.error("DELETE REPORT ERROR:", error);
      return sendError(res, 500, `Failed to delete report: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return sendError(res, 404, "Report not found.");
    }

    return res.status(200).json({
      success: true,
      message: "Report deleted successfully.",
      deleted: data[0],
    });
  } catch (err) {
    console.error("DELETE REPORT EXCEPTION:", err);
    return sendError(res, 500, "Server error deleting report.");
  }
});

// Multer and general error handling middleware
router.use((error, req, res, next) => {
  console.error("REPORTS ROUTER ERROR:", error);

  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Each photo evidence must be 3 MB or smaller."
        : "Failed to upload photo evidence.";
    return sendError(res, 400, message);
  }

  return sendError(res, 500, error.message || "Unexpected server error.");
});

module.exports = router;
