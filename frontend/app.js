// frontend/app.js
// FixMyStreet — Civic Issue Reporter Frontend Logic & Controller

const API = window.location.protocol === "file:" ? "http://localhost:3000/api" : "/api";
const sensitiveCategory = "Harassment or sexual offence";

// National and civic emergency helplines directory
const helplines = [
  { name: "Unified Emergency", number: "112", detail: "Police, Fire, and Medical emergencies", url: "https://112.gov.in/", symbol: "✚" },
  { name: "Women Helpline", number: "181", detail: "Women in distress & safety assistance", url: "https://www.wcd.gov.in/women/help", symbol: "🛡" },
  { name: "Childline India", number: "1098", detail: "Emergency child care & protection", url: "https://www.wcd.gov.in/", symbol: "✦" },
  { name: "Cyber Crime Helpline", number: "1930", detail: "Financial fraud & cyber threats", url: "https://cybercrime.gov.in/", symbol: "⌘" },
  { name: "Ambulance Services", number: "108 / 102", detail: "Emergency medical transport", url: "https://www.india.gov.in/directory/helpline", symbol: "✚" },
  { name: "Fire & Rescue Service", number: "101", detail: "Fire emergencies & hazard rescue", url: "https://www.india.gov.in/directory/helpline", symbol: "♨" },
  { name: "National Consumer Helpline", number: "1915", detail: "Consumer complaints & guidance", url: "https://consumerhelpline.gov.in/", symbol: "⚖" },
  { name: "Workplace Harassment", number: "SHe-Box", detail: "Government portal for workplace sexual harassment", url: "https://shebox.wcd.gov.in/", symbol: "🔒" }
];

// Helper: Query selector shortcut
const $ = (selector) => document.querySelector(selector);

// Set footer copyright year
if ($("#year")) {
  $("#year").textContent = new Date().getFullYear();
}

// XSS Prevention: Safe HTML escaping helper
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);
}

// Format UTC dates into human-readable local dates
function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Return CSS class corresponding to status
function getStatusClass(status) {
  if (status === "Resolved") return "resolved";
  if (status === "In progress") return "in-progress";
  if (status === "Under review") return "under-review";
  if (status === "Rejected") return "rejected";
  return "submitted";
}

// Helper to show inline form messages
function showFormMessage(message, isError = false) {
  const el = $("#formMessage");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", isError);
}

// -------------------------------------------------------------
// 1. Render Helpline Cards
// -------------------------------------------------------------
function renderHelplines() {
  const list = $("#helplineList");
  if (!list) return;

  list.innerHTML = helplines.map((item) => `
    <article class="helpline-card">
      <span class="helpline-symbol">${item.symbol}</span>
      <div>
        <b>${escapeHTML(item.name)}</b>
        <small>${escapeHTML(item.detail)}</small>
        <a href="${item.url}" target="_blank" rel="noopener">
          ${escapeHTML(item.number)} ↗
        </a>
      </div>
    </article>
  `).join("");
}

// -------------------------------------------------------------
// Local Mock Store for GitHub Pages / Static Hosting / Offline
// -------------------------------------------------------------
const defaultLocalReports = [
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

function getLocalReports() {
  try {
    const raw = localStorage.getItem("fixmystreet_reports");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return [...defaultLocalReports];
}

function saveLocalReports(reports) {
  try {
    localStorage.setItem("fixmystreet_reports", JSON.stringify(reports));
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
// 2. Fetch and Display Platform Summary Statistics
// -------------------------------------------------------------
async function loadStats() {
  try {
    const res = await fetch(`${API}/reports/stats`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.stats) {
        if ($("#statTotal")) $("#statTotal").textContent = data.stats.total;
        if ($("#statUnderReview")) $("#statUnderReview").textContent = data.stats.underReview;
        if ($("#statInProgress")) $("#statInProgress").textContent = data.stats.inProgress;
        if ($("#statResolved")) $("#statResolved").textContent = data.stats.resolved;
        return;
      }
    }
  } catch {
    // Fall back to local mock data
  }
  const reports = getLocalReports().filter((r) => !r.sensitive);
  if ($("#statTotal")) $("#statTotal").textContent = reports.length;
  if ($("#statUnderReview")) $("#statUnderReview").textContent = reports.filter(r => r.status === "Under review").length;
  if ($("#statInProgress")) $("#statInProgress").textContent = reports.filter(r => r.status === "In progress").length;
  if ($("#statResolved")) $("#statResolved").textContent = reports.filter(r => r.status === "Resolved").length;
}

// -------------------------------------------------------------
// 3. Fetch and Render Public Community Reports
// -------------------------------------------------------------
async function loadReports() {
  const list = $("#reportsList");
  if (!list) return;
  list.innerHTML = '<div class="loading-state">Loading community civic reports…</div>';

  const params = new URLSearchParams();
  const searchInput = $("#searchReports");
  const catSelect = $("#filterCategory");
  const statSelect = $("#filterStatus");

  const search = searchInput ? searchInput.value.trim() : "";
  const category = catSelect ? catSelect.value : "";
  const status = statSelect ? statSelect.value : "";

  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (status) params.set("status", status);

  let reports = [];
  try {
    const response = await fetch(`${API}/reports?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      reports = data.reports || [];
    } else {
      throw new Error("Backend offline");
    }
  } catch {
    // Fall back to local mock store on GitHub Pages / static hosting
    reports = getLocalReports().filter((r) => {
      if (r.sensitive) return false;
      if (category && r.category !== category) return false;
      if (status && r.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        const t = (r.title || "").toLowerCase();
        const d = (r.description || "").toLowerCase();
        const a = (r.area || "").toLowerCase();
        const ref = (r.reference_id || "").toLowerCase();
        if (!t.includes(q) && !d.includes(q) && !a.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    });
  }

  if (!reports.length) {
    list.innerHTML = `
      <div class="empty-state">
        No civic reports found matching your filter criteria. Be the first to report an issue!
      </div>
    `;
    return;
  }

  list.innerHTML = reports.map((report) => {
      const statusClass = getStatusClass(report.status);
      const photoUrl = report.evidence_url || report.evidence_path;

      return `
        <article class="report-card">
          <div class="report-card-top">
            <span class="category-pill">${escapeHTML(report.category)}</span>
            <span class="status-pill ${statusClass}">
              ${escapeHTML(report.status || "Submitted")}
            </span>
          </div>
          <h3>${escapeHTML(report.title)}</h3>
          <p>${escapeHTML((report.description || "").slice(0, 160))}${(report.description || "").length > 160 ? "…" : ""}</p>
          ${photoUrl ? `<img class="report-evidence-img" src="${escapeHTML(photoUrl)}" alt="Photo evidence" loading="lazy">` : ""}
          <div class="report-meta">
            <span>📍 ${escapeHTML(report.area || "Area not specified")}</span>
            <span class="report-track-link" data-track="${escapeHTML(report.reference_id)}">
              ${escapeHTML(report.reference_id)} ↗
            </span>
          </div>
        </article>
      `;
    }).join("");

    // Attach click listeners to reference ID badges for quick tracking
    list.querySelectorAll(".report-track-link").forEach((link) => {
      link.addEventListener("click", () => {
        const refId = link.dataset.track;
        if ($("#trackInput")) $("#trackInput").value = refId;
        const trackSec = $("#track");
        if (trackSec) trackSec.scrollIntoView({ behavior: "smooth" });
        trackReport(refId);
      });
    });
}

// -------------------------------------------------------------
// 4. Track Status by Reference ID
// -------------------------------------------------------------
async function trackReport(referenceId) {
  const resultContainer = $("#trackResult");
  if (!resultContainer) return;

  resultContainer.classList.remove("hidden");
  resultContainer.innerHTML = '<div class="loading-state">Looking up reference code in municipal records…</div>';

  let r = null;
  try {
    const res = await fetch(`${API}/reports/track/${encodeURIComponent(referenceId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.report) {
        r = data.report;
      }
    }
  } catch {
    // ignore
  }

  if (!r) {
    const query = String(referenceId || "").trim().toUpperCase();
    r = getLocalReports().find((item) => (item.reference_id || "").toUpperCase() === query || (item.id || "") === referenceId);
  }

  if (!r) {
    resultContainer.innerHTML = `
      <div class="empty-state">
        ⚠️ No municipal report found for reference ID "${escapeHTML(referenceId)}".
      </div>
    `;
    return;
  }

  try {
    const stages = ["Submitted", "Under review", "In progress", "Resolved"];
    const isRejected = r.status === "Rejected";
    const currentStageIndex = stages.indexOf(r.status);
    const photoUrl = r.evidence_url || r.evidence_path;

    const timelineHTML = isRejected
      ? `
        <div class="stepper-timeline">
          <div class="stepper-step completed">
            <div class="step-bubble">✓</div>
            <span>Submitted</span>
            <small>${formatDate(r.created_at)}</small>
          </div>
          <div class="stepper-step rejected">
            <div class="step-bubble">✕</div>
            <span>Rejected</span>
            <small>${formatDate(r.updated_at)}</small>
          </div>
        </div>
      `
      : `
        <div class="stepper-timeline">
          ${stages.map((stage, idx) => {
            let cls = "";
            let icon = idx + 1;
            if (idx < currentStageIndex || (r.status === "Resolved" && idx === currentStageIndex)) {
              cls = "completed";
              icon = "✓";
            } else if (idx === currentStageIndex) {
              cls = "active";
            }
            return `
              <div class="stepper-step ${cls}">
                <div class="step-bubble">${icon}</div>
                <span>${stage}</span>
                <small>${idx === currentStageIndex ? "Current" : (idx < currentStageIndex ? "Passed" : "")}</small>
              </div>
            `;
          }).join("")}
        </div>
      `;

    resultContainer.innerHTML = `
      <div class="report-card-top" style="margin-bottom: 12px;">
        <span class="category-pill">${escapeHTML(r.category)}</span>
        <span class="status-pill ${getStatusClass(r.status)}">${escapeHTML(r.status)}</span>
      </div>
      <h3 style="font-size: 20px; color: var(--navy); margin-bottom: 6px;">${escapeHTML(r.title)}</h3>
      <p style="font-size: 14px; color: #475569; margin-bottom: 16px;">${escapeHTML(r.description)}</p>

      ${timelineHTML}

      ${photoUrl ? `
        <div style="margin: 16px 0;">
          <b style="font-size:12px; color:var(--navy); display:block; margin-bottom:6px;">Photo Evidence Attached:</b>
          <img class="track-evidence-img" src="${escapeHTML(photoUrl)}" alt="Photo evidence attached to report">
        </div>
      ` : ""}

      <div class="track-detail-grid">
        <div class="track-detail-item">
          <b>Official Reference Code</b>
          <span>${escapeHTML(r.reference_id)}</span>
        </div>
        <div class="track-detail-item">
          <b>Locality / Ward</b>
          <span>${escapeHTML(r.area)}</span>
        </div>
        <div class="track-detail-item">
          <b>Urgency Priority</b>
          <span>${escapeHTML(r.priority || "Normal")}</span>
        </div>
        <div class="track-detail-item">
          <b>Report Date</b>
          <span>${formatDate(r.created_at)}</span>
        </div>
      </div>

      <div class="admin-notes-callout">
        <b>Official Municipal Response</b>
        <p>${escapeHTML(r.admin_notes || "Awaiting initial inspection notes from the ward maintenance desk.")}</p>
      </div>
    `;
  } catch (err) {
    console.error("Track error:", err);
    resultContainer.innerHTML = `
      <div class="empty-state">
        An unexpected error occurred while looking up this report. Please verify connection and retry.
      </div>
    `;
  }
}

// -------------------------------------------------------------
// 5. Photo File Preview and Removal Handlers
// -------------------------------------------------------------
const photoInput = $("#photo");
const photoPreviewWrap = $("#photoPreviewWrap");
const photoPreview = $("#photoPreview");
const removePhotoBtn = $("#removePhotoBtn");

if (photoInput) {
  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) {
      if (photoPreviewWrap) photoPreviewWrap.classList.add("hidden");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showFormMessage("Photo must be 3 MB or smaller.", true);
      photoInput.value = "";
      if (photoPreviewWrap) photoPreviewWrap.classList.add("hidden");
      return;
    }

    showFormMessage("");
    const reader = new FileReader();
    reader.onload = (e) => {
      if (photoPreview) photoPreview.src = e.target.result;
      if (photoPreviewWrap) photoPreviewWrap.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  });
}

if (removePhotoBtn) {
  removePhotoBtn.addEventListener("click", () => {
    if (photoInput) photoInput.value = "";
    if (photoPreview) photoPreview.src = "";
    if (photoPreviewWrap) photoPreviewWrap.classList.add("hidden");
  });
}

// -------------------------------------------------------------
// 6. Submit New Report Form
// -------------------------------------------------------------
const reportForm = $("#reportForm");
if (reportForm) {
  reportForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const category = $("#category")?.value.trim() || "";
    const title = $("#title")?.value.trim() || "";
    const description = $("#description")?.value.trim() || "";
    const area = $("#area")?.value.trim() || "";
    const address = $("#address")?.value.trim() || "";
    const priority = $("#priority")?.value || "Normal";
    const contact = $("#contact")?.value.trim() || "";
    const reporter = $("#reporter")?.value.trim() || "";
    const confirmed = $("#confirm")?.checked;

    // Validation
    if (!category) {
      showFormMessage("Please select an issue category.", true);
      const catEl = $("#category");
      if (catEl) { catEl.focus(); catEl.scrollIntoView({ behavior: "smooth", block: "center" }); }
      return;
    }
    if (title.length < 4 || title.length > 120) {
      showFormMessage("Issue title must be between 4 and 120 characters.", true);
      const titleEl = $("#title");
      if (titleEl) { titleEl.focus(); titleEl.scrollIntoView({ behavior: "smooth", block: "center" }); }
      return;
    }
    if (description.length < 10 || description.length > 3000) {
      showFormMessage("Description must be between 10 and 3000 characters.", true);
      const descEl = $("#description");
      if (descEl) { descEl.focus(); descEl.scrollIntoView({ behavior: "smooth", block: "center" }); }
      return;
    }
    if (!area) {
      showFormMessage("Please enter the locality or ward area.", true);
      const areaEl = $("#area");
      if (areaEl) { areaEl.focus(); areaEl.scrollIntoView({ behavior: "smooth", block: "center" }); }
      return;
    }
    if (contact && !/^[0-9+\-\s()]{7,20}$/.test(contact)) {
      showFormMessage("Please enter a valid telephone contact number (7 to 20 digits).", true);
      const contactEl = $("#contact");
      if (contactEl) { contactEl.focus(); contactEl.scrollIntoView({ behavior: "smooth", block: "center" }); }
      return;
    }
    if (!confirmed) {
      showFormMessage("Please confirm the good-faith declaration checkbox.", true);
      const confirmEl = $("#confirm");
      if (confirmEl) { confirmEl.focus(); confirmEl.scrollIntoView({ behavior: "smooth", block: "center" }); }
      return;
    }

    // Safety confirmation for sensitive reports
    if (category === sensitiveCategory) {
      const proceed = confirm(
        "CONFIDENTIAL SAFETY REPORT NOTICE:\n\n" +
        "This report is classified as confidential and will NOT appear on the public feed.\n" +
        "Note: FixMyStreet is an academic demo and does not replace emergency dispatchers.\n" +
        "If you or anyone is in immediate danger, please dial 112 directly.\n\n" +
        "Do you wish to submit this confidential report?"
      );
      if (!proceed) return;
    }

    const submitBtn = $("#submitReportBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = "Submitting to Municipal Queue…";
    }
    showFormMessage("");

    try {
      const photoFile = photoInput?.files?.[0];
      let response;

      if (photoFile) {
        // Use FormData for multipart file upload
        const formData = new FormData();
        formData.append("category", category);
        formData.append("title", title);
        formData.append("description", description);
        formData.append("area", area);
        if (address) formData.append("address", address);
        formData.append("priority", priority);
        if (contact) formData.append("contact", contact);
        if (reporter) formData.append("reporter_name", reporter);
        formData.append("photo", photoFile);

        response = await fetch(`${API}/reports`, {
          method: "POST",
          body: formData,
        });
      } else {
        // Standard JSON payload
        const payload = {
          category,
          title,
          description,
          area,
          address,
          priority,
          contact,
          reporter_name: reporter,
        };

        response = await fetch(`${API}/reports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "The server rejected the report submission.");
      }

      const saved = result.report || {};
      const refCode = saved.reference_id || result.reference_id;

      if ($("#referenceId")) $("#referenceId").textContent = refCode;
      if ($("#modalText")) {
        $("#modalText").textContent = saved.sensitive
          ? "Your confidential report has been securely registered. It has been routed to designated municipal staff and kept out of the public feed."
          : "Your civic issue report has been registered. Please save your reference ID to monitor progress.";
      }

      if ($("#resultModal")) $("#resultModal").classList.remove("hidden");
      reportForm.reset();
      if (photoPreviewWrap) photoPreviewWrap.classList.add("hidden");
      if (photoPreview) photoPreview.src = "";

      // Reload public feed and stats
      await loadReports();
      await loadStats();
    } catch (error) {
      console.warn("Backend API unavailable, saving report locally:", error);
      // Fallback for static hosting / GitHub Pages / offline demo
      const refCode = "FSM-" + Math.random().toString(36).substring(2, 6).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
      const isSensitive = category === sensitiveCategory;
      const newReport = {
        id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
        reference_id: refCode,
        category,
        title,
        description,
        area,
        address: address || null,
        priority: priority || "Normal",
        status: "Submitted",
        admin_notes: null,
        sensitive: isSensitive,
        reporter_name: reporter || "Anonymous Citizen",
        contact: contact || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const reports = getLocalReports();
      reports.unshift(newReport);
      saveLocalReports(reports);

      if ($("#referenceId")) $("#referenceId").textContent = refCode;
      if ($("#modalText")) {
        $("#modalText").textContent = isSensitive
          ? "Your confidential report has been securely registered. It has been routed to designated municipal staff and kept out of the public feed."
          : "Your civic issue report has been registered. Please save your reference ID to monitor progress.";
      }
      if ($("#resultModal")) $("#resultModal").classList.remove("hidden");
      reportForm.reset();
      if (photoPreviewWrap) photoPreviewWrap.classList.add("hidden");
      if (photoPreview) photoPreview.src = "";
      await loadReports();
      await loadStats();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Submit Civic Report <span>↗</span>";
      }
    }
  });
}

// -------------------------------------------------------------
// 7. Modal and Reference Copy Actions
// -------------------------------------------------------------
function closeModal() {
  const modal = $("#resultModal");
  if (modal) modal.classList.add("hidden");
}

if ($("#closeModal")) $("#closeModal").addEventListener("click", closeModal);
if ($("#doneModal")) $("#doneModal").addEventListener("click", closeModal);
if ($("#resultModal")) {
  $("#resultModal").addEventListener("click", (e) => {
    if (e.target.id === "resultModal") closeModal();
  });
}

if ($("#copyReference")) {
  $("#copyReference").addEventListener("click", async () => {
    const refEl = $("#referenceId");
    if (!refEl) return;
    try {
      await navigator.clipboard.writeText(refEl.textContent.trim());
      $("#copyReference").textContent = "✓ Copied to Clipboard!";
      setTimeout(() => {
        $("#copyReference").textContent = "Copy Reference ID";
      }, 2000);
    } catch {
      $("#copyReference").textContent = "Select ID to copy";
    }
  });
}

if ($("#trackNowBtn")) {
  $("#trackNowBtn").addEventListener("click", () => {
    const refCode = $("#referenceId")?.textContent.trim();
    closeModal();
    if (refCode && $("#trackInput")) {
      $("#trackInput").value = refCode;
      const trackSec = $("#track");
      if (trackSec) trackSec.scrollIntoView({ behavior: "smooth" });
      trackReport(refCode);
    }
  });
}

// Track search form submit
if ($("#trackForm")) {
  $("#trackForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const ref = $("#trackInput")?.value.trim();
    if (ref) trackReport(ref);
  });
}

// -------------------------------------------------------------
// 8. Category Selector Grid Shortcuts
// -------------------------------------------------------------
document.querySelectorAll("[data-category]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const cat = btn.dataset.category;
    if ($("#category")) $("#category").value = cat;
    const repSec = $("#report");
    if (repSec) repSec.scrollIntoView({ behavior: "smooth" });
    if ($("#category")) $("#category").focus({ preventScroll: true });
  });
});

// -------------------------------------------------------------
// 9. Search and Filter Listeners
// -------------------------------------------------------------
if ($("#refreshReports")) $("#refreshReports").addEventListener("click", loadReports);
if ($("#filterCategory")) $("#filterCategory").addEventListener("change", loadReports);
if ($("#filterStatus")) $("#filterStatus").addEventListener("change", loadReports);

let searchDebounce;
if ($("#searchReports")) {
  $("#searchReports").addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadReports, 300);
  });
}

// Mobile navigation toggle
if ($("#menuToggle")) {
  $("#menuToggle").addEventListener("click", () => {
    const nav = $("#mainNav");
    if (nav) nav.classList.toggle("open");
  });
}

if ($("#mainNav")) {
  $("#mainNav").querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      const nav = $("#mainNav");
      if (nav) nav.classList.remove("open");
    });
  });
}

// -------------------------------------------------------------
// 10. Municipal Staff / Admin Desk Controller
// -------------------------------------------------------------
let currentAdminKey = "";
let adminReportsCache = [];

if ($("#openAdminNav")) {
  $("#openAdminNav").addEventListener("click", (e) => {
    e.preventDefault();
    const adminSec = $("#admin");
    if (adminSec) adminSec.scrollIntoView({ behavior: "smooth" });
    if (!currentAdminKey && $("#adminKeyInput")) {
      $("#adminKeyInput").focus();
    }
  });
}

// Quick demo key autofill helper
if ($("#adminFillKeyBtn")) {
  $("#adminFillKeyBtn").addEventListener("click", () => {
    const input = $("#adminKeyInput");
    if (input) {
      input.value = "VICTORIASECRETSUPERMODELADRIANALIMA";
      input.focus();
    }
  });
}

if ($("#adminLoginBtn")) {
  $("#adminLoginBtn").addEventListener("click", async () => {
    const key = $("#adminKeyInput")?.value.trim() || "";
    const msgEl = $("#adminAuthMessage");
    if (msgEl) {
      msgEl.textContent = "";
      msgEl.classList.remove("error");
    }

    if (!key) {
      if (msgEl) {
        msgEl.textContent = "Please enter the ADMIN_API_KEY.";
        msgEl.classList.add("error");
      }
      return;
    }

    if (msgEl) msgEl.textContent = "Authenticating with server…";

    try {
      const res = await fetch(`${API}/reports/admin`, {
        headers: { "x-admin-key": key },
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid administrator key.");
      }

      currentAdminKey = key;
      adminReportsCache = data.reports || [];

      if ($("#adminAuthBox")) $("#adminAuthBox").classList.add("hidden");
      if ($("#adminDashboard")) $("#adminDashboard").classList.remove("hidden");
      renderAdminReports(adminReportsCache);
    } catch (err) {
      if (msgEl) {
        msgEl.textContent = err.message;
        msgEl.classList.add("error");
      }
    }
  });
}

if ($("#adminLogoutBtn")) {
  $("#adminLogoutBtn").addEventListener("click", () => {
    currentAdminKey = "";
    adminReportsCache = [];
    if ($("#adminKeyInput")) $("#adminKeyInput").value = "";
    if ($("#adminDashboard")) $("#adminDashboard").classList.add("hidden");
    if ($("#adminAuthBox")) $("#adminAuthBox").classList.remove("hidden");
  });
}

if ($("#adminRefreshBtn")) {
  $("#adminRefreshBtn").addEventListener("click", loadAdminReports);
}

async function loadAdminReports() {
  if (!currentAdminKey) return;
  try {
    const res = await fetch(`${API}/reports/admin`, {
      headers: { "x-admin-key": currentAdminKey },
    });
    const data = await res.json();
    if (data.success) {
      adminReportsCache = data.reports || [];
      renderAdminReports(adminReportsCache);
    }
  } catch (err) {
    console.error("Admin refresh error:", err);
  }
}

function renderAdminReports(reports) {
  const container = $("#adminReportsList");
  if (!container) return;

  if ($("#adminReportCount")) {
    $("#adminReportCount").textContent = `${reports.length} total municipal grievance records`;
  }

  const search = $("#adminSearchInput")?.value.trim().toLowerCase() || "";
  const statusFilter = $("#adminStatusFilter")?.value || "";

  const filtered = reports.filter((r) => {
    const matchesSearch =
      !search ||
      (r.title && r.title.toLowerCase().includes(search)) ||
      (r.reference_id && r.reference_id.toLowerCase().includes(search)) ||
      (r.area && r.area.toLowerCase().includes(search));

    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state">No grievance records match the current filter.</div>';
    return;
  }

  container.innerHTML = filtered.map((r) => {
    const photoUrl = r.evidence_url || r.evidence_path;
    const statusClass = getStatusClass(r.status);

    return `
      <article class="admin-report-card ${r.sensitive ? "sensitive" : ""}" data-ref="${escapeHTML(r.reference_id)}">
        <div class="admin-card-head">
          <div>
            <strong>${escapeHTML(r.reference_id)}</strong>
            <span class="category-pill">${escapeHTML(r.category)}</span>
            ${r.sensitive ? '<span class="status-pill rejected">Confidential Safety Report</span>' : ""}
          </div>
          <span class="status-pill ${statusClass}">${escapeHTML(r.status)}</span>
        </div>

        <div class="admin-card-body">
          <h4>${escapeHTML(r.title)}</h4>
          <p>${escapeHTML(r.description)}</p>
          ${photoUrl ? `<img class="admin-evidence-img" src="${escapeHTML(photoUrl)}" alt="Photo evidence" loading="lazy">` : ""}
        </div>

        <div class="admin-card-meta">
          <span>📍 Locality: <b>${escapeHTML(r.area)}</b></span>
          ${r.address ? `<span>🏢 Landmark: <b>${escapeHTML(r.address)}</b></span>` : ""}
          <span>⚡ Priority: <b>${escapeHTML(r.priority)}</b></span>
          <span>👤 Reporter: <b>${escapeHTML(r.reporter_name || "Anonymous")}</b></span>
          <span>📞 Contact: <b>${escapeHTML(r.contact || "None provided")}</b></span>
          <span>📅 Logged: <b>${formatDate(r.created_at)}</b></span>
        </div>

        <div class="admin-action-row">
          <label style="font-size: 11px; font-weight: 700; color: var(--navy);">Update Status:</label>
          <select class="admin-status-select">
            <option ${r.status === "Submitted" ? "selected" : ""}>Submitted</option>
            <option ${r.status === "Under review" ? "selected" : ""}>Under review</option>
            <option ${r.status === "In progress" ? "selected" : ""}>In progress</option>
            <option ${r.status === "Resolved" ? "selected" : ""}>Resolved</option>
            <option ${r.status === "Rejected" ? "selected" : ""}>Rejected</option>
          </select>
          <input
            class="admin-notes-input"
            type="text"
            placeholder="Add official municipal note / action taken..."
            value="${escapeHTML(r.admin_notes || "")}"
          >
          <button class="btn btn-dark btn-save-status" data-id="${escapeHTML(r.id || r.reference_id)}">Save Status</button>
          <button class="btn btn-danger btn-delete-report" data-id="${escapeHTML(r.id || r.reference_id)}">Delete</button>
          <span class="toast-area"></span>
        </div>
      </article>
    `;
  }).join("");

  // Attach action handlers for each report row
  container.querySelectorAll(".btn-save-status").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".admin-report-card");
      if (!card) return;

      const id = btn.dataset.id;
      const statusSelect = card.querySelector(".admin-status-select");
      const notesInput = card.querySelector(".admin-notes-input");
      const toastArea = card.querySelector(".toast-area");

      const newStatus = statusSelect ? statusSelect.value : "Submitted";
      const notes = notesInput ? notesInput.value : "";

      btn.disabled = true;
      btn.textContent = "Saving…";

      try {
        const res = await fetch(`${API}/reports/${encodeURIComponent(id)}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": currentAdminKey,
          },
          body: JSON.stringify({ status: newStatus, admin_notes: notes }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Status update failed.");

        // Show inline feedback toast
        if (toastArea) {
          toastArea.innerHTML = `<span class="toast-badge">✓ Saved (${escapeHTML(newStatus)})</span>`;
          setTimeout(() => { toastArea.innerHTML = ""; }, 3000);
        }

        // Update card header status badge immediately
        const headBadge = card.querySelector(".admin-card-head > .status-pill");
        if (headBadge) {
          headBadge.className = `status-pill ${getStatusClass(newStatus)}`;
          headBadge.textContent = newStatus;
        }

        await loadReports();
        await loadStats();
      } catch (err) {
        alert(`Error: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = "Save Status";
      }
    });
  });

  container.querySelectorAll(".btn-delete-report").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (!confirm("Are you sure you want to permanently delete this report record?")) {
        return;
      }

      btn.disabled = true;
      btn.textContent = "Deleting…";

      try {
        const res = await fetch(`${API}/reports/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: { "x-admin-key": currentAdminKey },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to delete.");

        await loadAdminReports();
        await loadReports();
        await loadStats();
      } catch (err) {
        alert(`Delete error: ${err.message}`);
        btn.disabled = false;
        btn.textContent = "Delete";
      }
    });
  });
}

if ($("#adminSearchInput")) {
  $("#adminSearchInput").addEventListener("input", () => renderAdminReports(adminReportsCache));
}

if ($("#adminStatusFilter")) {
  $("#adminStatusFilter").addEventListener("change", () => renderAdminReports(adminReportsCache));
}

// -------------------------------------------------------------
// 11. Initial Application Bootstrap
// -------------------------------------------------------------
renderHelplines();
loadStats();
loadReports();
