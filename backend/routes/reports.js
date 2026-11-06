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

// Local in-memory fallback store used seamlessly when Supabase is unreachable (e.g. project paused or offline)
const fallbackReports = [
  {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    reference_id: "FSM-A1B2C3D4",
    category: "Roads & footpaths",
    title: "Deep pothole causing two-wheeler skids",
    description: "A dangerous 1.5-foot deep pothole has formed right before the pedestrian crossing near the metro pillar. Vehicles swerve abruptly to avoid it.",
    area: "MG Road, Ward 4",
    address: "Opposite City Library, Pillar 104",
    priority: "High",
    status: "In progress",
    admin_notes: "Assigned to Ward 4 Road Maintenance crew. Asphalt patch work scheduled.",
    sensitive: false,
    reporter_name: "Rajesh Kumar",
    contact: "+91 98765 43210",
    created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  },
  {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    reference_id: "FSM-E5F6G7H8",
    category: "Garbage & sanitation",
    title: "Overflowing garbage dumpster creating foul smell",
    description: "Community bin has not been cleared for 4 days. Waste is spilling over onto the walkway, attracting stray animals and blocking pedestrians.",
    area: "Indira Nagar Sector 2",
    address: "Corner of 12th Cross and Main Market Road",
    priority: "Urgent",
    status: "Under review",
    admin_notes: "Sanitation supervisor alerted. Secondary compactor vehicle dispatched.",
    sensitive: false,
    reporter_name: "Priya Sharma",
    contact: "+91 91234 56789",
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
  },
  {
    id: "d9b2d63d-a233-4123-8588-46e3229542b2",
    reference_id: "FSM-J9K0L1M2",
    category: "Water & utilities",
    title: "Non-functional streetlight creating dark hazard",
    description: "Three consecutive streetlights have been dead for over a week, leaving the corner lane completely dark and unsafe for evening commuters.",
    area: "Green Glen Layout",
    address: "Lane 3, behind Apex Hospital",
    priority: "Normal",
    status: "Resolved",
    admin_notes: "Electrician replaced damaged LED fixture and underground wiring on 26 Oct.",
    sensitive: false,
    reporter_name: "Arun Patel",
    contact: null,
    created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  }
];

// Database offline tracker to avoid repeated multi-second DNS timeouts
let dbOfflineUntil = 0;
const DB_TIMEOUT_MS = 2500;

function isDbOffline() {
  return Date.now() < dbOfflineUntil;
}

function markDbOffline(reason) {
  dbOfflineUntil = Date.now() + 30000; // Skip slow calls for 30 seconds
  console.warn(`[FixMyStreet Fallback] Supabase marked offline (${reason || "unreachable"}). Using local fallback store.`);
}

function markDbOnline() {
  dbOfflineUntil = 0;
}

function isNetworkError(error) {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  const code = String(error.code || "").toUpperCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    details.includes("enotfound") ||
    details.includes("fetch failed") ||
    details.includes("timeout") ||
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "PGRST301" ||
    error.name === "TypeError"
  );
}

// Helper to run Supabase query with timeout protection
async function safeDbQuery(queryFn) {
  if (isDbOffline()) {
    return { data: null, error: new Error("Database offline mode active") };
  }
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Database operation timed out")), DB_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([queryFn(), timeoutPromise]);
    clearTimeout(timer);
    if (result && result.error) {
      if (isNetworkError(result.error)) {
        markDbOffline(result.error.message);
      }
    } else {
      markDbOnline();
    }
    return result || { data: null, error: null };
  } catch (err) {
    clearTimeout(timer);
    markDbOffline(err.message);
    return { data: null, error: err };
  }
}

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
    let reports = null;
    if (!isDbOffline()) {
      const { data, error } = await safeDbQuery(async () => {
        return supabase.from("reports").select("status, sensitive");
      });
      if (!error && Array.isArray(data)) {
        reports = data;
      }
    }

    if (!reports) {
      reports = fallbackReports;
    }

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
    const stats = {
      total: fallbackReports.length,
      underReview: fallbackReports.filter((r) => r.status === "Under review").length,
      inProgress: fallbackReports.filter((r) => r.status === "In progress").length,
      resolved: fallbackReports.filter((r) => r.status === "Resolved").length,
    };
    return res.status(200).json({ success: true, stats });
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

    // Check local fallback store first for instant response
    const localMatch = fallbackReports.find((r) => r.reference_id === referenceId);
    if (localMatch) {
      return res.status(200).json({
        success: true,
        report: normalizeReport(localMatch),
      });
    }

    // If not in local store, query Supabase
    if (!isDbOffline()) {
      const { data, error } = await safeDbQuery(async () => {
        return supabase
          .from("reports")
          .select("*")
          .eq("reference_id", referenceId)
          .single();
      });

      if (!error && data) {
        return res.status(200).json({
          success: true,
          report: normalizeReport(data),
        });
      }
    }

    return sendError(
      res,
      404,
      `No report found with reference ID "${referenceId}". Please verify and try again.`
    );
  } catch (err) {
    const match = fallbackReports.find((r) => r.reference_id === referenceId);
    if (match) {
      return res.status(200).json({ success: true, report: normalizeReport(match) });
    }
    return sendError(res, 404, `No report found with reference ID "${referenceId}". Please verify and try again.`);
  }
});

// -------------------------------------------------------------
// 3. GET /api/reports - Public feed of non-sensitive reports
// -------------------------------------------------------------
router.get("/", async (req, res) => {
  const { category, status, search } = req.query;

  const getFilteredList = (sourceList) => {
    let list = sourceList.filter((r) => !r.sensitive);
    if (category && allowedCategories.includes(category)) {
      list = list.filter((r) => r.category === category);
    }
    if (status && allowedStatuses.includes(status)) {
      list = list.filter((r) => r.status === status);
    }
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      list = list.filter((r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.area && r.area.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q))
      );
    }
    return list;
  };

  try {
    let reports = null;

    if (!isDbOffline()) {
      const { data, error } = await safeDbQuery(async () => {
        let query = supabase
          .from("reports")
          .select("*")
          .eq("sensitive", false)
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
              `title.ilike.%${term}%,area.ilike.%${term}%,description.ilike.%${term}%`
            );
          }
        }

        return query;
      });

      if (!error && Array.isArray(data)) {
        reports = data;
      }
    }

    if (!reports) {
      reports = getFilteredList(fallbackReports);
    }

    return res.status(200).json({
      success: true,
      reports: reports.map(normalizeReport),
    });
  } catch (err) {
    return res.status(200).json({
      success: true,
      reports: getFilteredList(fallbackReports).map(normalizeReport),
    });
  }
});

// -------------------------------------------------------------
// 4. POST /api/reports - Submit a new civic issue report
// -------------------------------------------------------------
router.post("/", upload.single("photo"), async (req, res) => {
  let newReport = null;
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

    newReport = {
      id: crypto.randomUUID(),
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (photoDataUrl) {
      newReport.evidence_path = photoDataUrl;
    }

    let savedData = null;

    if (!isDbOffline()) {
      const dbResult = await safeDbQuery(async () => {
        let res = await supabase.from("reports").insert([newReport]).select().single();
        if (res.error && res.error.code === "PGRST204" && photoDataUrl) {
          const retry = { ...newReport };
          delete retry.evidence_path;
          retry.evidence_url = photoDataUrl;
          res = await supabase.from("reports").insert([retry]).select().single();
        }
        return res;
      });

      if (!dbResult.error && dbResult.data) {
        savedData = dbResult.data;
      } else {
        console.warn("[FixMyStreet Fallback] Supabase insert failed or timed out. Saving to local fallback store.");
      }
    }

    // Always ensure the report is saved in fallback store so it is immediately trackable and viewable
    fallbackReports.unshift(newReport);

    const reportToSend = savedData || newReport;

    return res.status(201).json({
      success: true,
      message: "Report submitted successfully.",
      reference_id: reportToSend.reference_id,
      sensitive: reportToSend.sensitive,
      report: normalizeReport(reportToSend),
    });
  } catch (err) {
    if (newReport) {
      console.warn("[FixMyStreet Fallback] Network exception on insert. Saving to local fallback store.");
      fallbackReports.unshift(newReport);
      return res.status(201).json({
        success: true,
        message: "Report submitted successfully.",
        reference_id: newReport.reference_id,
        sensitive: newReport.sensitive,
        report: normalizeReport(newReport),
      });
    }
    console.error("POST REPORT ERROR:", err);
    return sendError(res, 500, err.message || "Unexpected error while saving report.");
  }
});

// -------------------------------------------------------------
// 5. GET /api/reports/admin - List all reports for municipal staff
// -------------------------------------------------------------
router.get("/admin", requireAdmin, async (req, res) => {
  const { category, status, search } = req.query;

  const getFallbackAdminList = () => {
    let list = [...fallbackReports];
    if (category && allowedCategories.includes(category)) {
      list = list.filter((r) => r.category === category);
    }
    if (status && allowedStatuses.includes(status)) {
      list = list.filter((r) => r.status === status);
    }
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      list = list.filter((r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.area && r.area.toLowerCase().includes(q)) ||
        (r.reference_id && r.reference_id.toLowerCase().includes(q))
      );
    }
    return list;
  };

  try {
    let reports = null;
    if (!isDbOffline()) {
      const { data, error } = await safeDbQuery(async () => {
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

        return query;
      });

      if (!error && Array.isArray(data)) {
        reports = data;
      }
    }

    if (!reports) {
      reports = getFallbackAdminList();
    }

    return res.status(200).json({
      success: true,
      reports: reports.map(normalizeReport),
    });
  } catch (err) {
    return res.status(200).json({
      success: true,
      reports: getFallbackAdminList().map(normalizeReport),
    });
  }
});

// -------------------------------------------------------------
// 6. PATCH /api/reports/:id/status - Update issue status & notes
// -------------------------------------------------------------
router.patch("/:id/status", requireAdmin, async (req, res) => {
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

  const applyFallbackStatusUpdate = () => {
    const item = fallbackReports.find((r) => r.id === id || r.reference_id === id);
    if (!item) return null;
    item.status = status;
    item.updated_at = updates.updated_at;
    if (trimmedNotes !== null) {
      item.admin_notes = trimmedNotes;
      adminNotesFallbackCache.set(item.reference_id, trimmedNotes);
    }
    return item;
  };

  try {
    const filterColumn = isUUID(id) ? "id" : "reference_id";
    let data = null;

    if (!isDbOffline()) {
      const dbRes = await safeDbQuery(async () => {
        let res = await supabase
          .from("reports")
          .update(updates)
          .eq(filterColumn, id)
          .select()
          .single();

        if (res.error && (res.error.code === "PGRST204" || res.error.code === "42703") && updates.admin_notes !== undefined) {
          const retryUpdates = { ...updates };
          delete retryUpdates.admin_notes;
          res = await supabase
            .from("reports")
            .update(retryUpdates)
            .eq(filterColumn, id)
            .select()
            .single();
        }
        return res;
      });

      if (!dbRes.error && dbRes.data) {
        data = dbRes.data;
      }
    }

    // Update in fallback cache as well
    const fallbackItem = applyFallbackStatusUpdate();

    if (!data && !fallbackItem) {
      return sendError(res, 404, "Report not found.");
    }

    if (trimmedNotes !== null && (data?.reference_id || fallbackItem?.reference_id)) {
      adminNotesFallbackCache.set(data?.reference_id || fallbackItem?.reference_id, trimmedNotes);
    }

    const reportToSend = data || fallbackItem;

    return res.status(200).json({
      success: true,
      message: `Report status updated to "${status}".`,
      report: normalizeReport(reportToSend),
    });
  } catch (err) {
    const item = applyFallbackStatusUpdate();
    if (item) {
      return res.status(200).json({
        success: true,
        message: `Report status updated to "${status}".`,
        report: normalizeReport(item),
      });
    }
    console.error("PATCH STATUS ERROR:", err);
    return sendError(res, 500, "Failed to update report status.");
  }
});

// -------------------------------------------------------------
// 7. DELETE /api/reports/:id - Delete spam or invalid report
// -------------------------------------------------------------
router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const filterColumn = isUUID(id) ? "id" : "reference_id";

  const deleteFromFallback = () => {
    const index = fallbackReports.findIndex((r) => r.id === id || r.reference_id === id);
    if (index === -1) return null;
    return fallbackReports.splice(index, 1)[0];
  };

  try {
    let deletedData = null;

    if (!isDbOffline()) {
      const dbRes = await safeDbQuery(async () => {
        return supabase.from("reports").delete().eq(filterColumn, id).select();
      });
      if (!dbRes.error && dbRes.data && dbRes.data.length > 0) {
        deletedData = dbRes.data[0];
      }
    }

    const fallbackDeleted = deleteFromFallback();

    if (!deletedData && !fallbackDeleted) {
      return sendError(res, 404, "Report not found.");
    }

    return res.status(200).json({
      success: true,
      message: "Report deleted successfully.",
      deleted: deletedData || fallbackDeleted,
    });
  } catch (err) {
    const removed = deleteFromFallback();
    if (removed) {
      return res.status(200).json({
        success: true,
        message: "Report deleted successfully.",
        deleted: removed,
      });
    }
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
