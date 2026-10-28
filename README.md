# FixMyStreet — Civic Issue Reporter

> **Universal Full-Stack Web Application for Citizen Grievance Redressal and Urban Civic Governance**  
> Built with HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, and Supabase PostgreSQL.

---

## 1. Project Overview & Real-World Problem

Rapid urbanization and municipal delays often leave common civic problems unresolved — dangerous potholes, broken streetlights, uncollected waste heaps, open storm drains, and public utility hazards. Citizens often lack a direct, transparent channel to report these problems, follow up on repairs, or hold local civic authorities accountable.

**FixMyStreet** solves this challenge by providing an accessible, community-driven civic reporting portal. Citizens can document and report hazards in under two minutes without requiring a complex registration process, receive a cryptographic reference code (`FSM-XXXXXXXX`), and track municipal resolution milestones in real time. Municipal ward officers and staff have access to a secured administrative desk to review issues, prioritize field repairs, add official progress notes, and resolve grievances.

---

## 2. Project Objectives

- **Empower Community Redressal:** Give residents an intuitive, mobile-friendly interface to report street-level civic issues.
- **Provide Transparent Tracking:** Provide live status tracking (`Submitted` → `Under review` → `In progress` → `Resolved`) using unique reference codes.
- **Ensure Citizen Safety & Confidentiality:** Separate sensitive harassment or safety incidents from public feeds while highlighting verified emergency helplines (112, 181, 1098).
- **Streamline Municipal Workflows:** Provide municipal officers with an authenticated case-management desk to update progress notes and mark resolutions.
- **Deliver an Accessible Educational Blueprint:** Demonstrate clean, production-grade full-stack architecture for B.Tech students using only standard web technologies (no heavy frameworks).

---

## 3. Target Users & Roles

| Role | Access Privileges | Primary Responsibilities |
|---|---|---|
| **Citizen (Public)** | Public / Anonymous | • Browse open community civic reports<br>• Filter by category and locality<br>• File new civic reports with location and urgency<br>• Track live status via reference ID (`FSM-XXXXXXXX`)<br>• Access emergency helpline directory |
| **Municipal Staff / Admin** | Protected via `ADMIN_API_KEY` | • Authenticate into the municipal staff portal<br>• View all reports (including confidential safety issues)<br>• Review citizen contact numbers for follow-up<br>• Update status milestones with official notes<br>• Delete spam, abusive, or duplicate reports |

---

## 4. Key Implemented Features

1. **Instant Grievance Reporting:** Submit civic issues across 8 categories with title, description, locality, landmark, and urgency level.
2. **Cryptographic Reference Generation:** Automatic server-side generation of tracking codes (e.g., `FSM-A1B2C3D4`).
3. **Citizen Status Tracker:** Stepper visualization displaying issue milestones, submission timestamps, and official municipal remarks.
4. **Community Feed & Real-Time Filtering:** Search by keyword/locality and filter by category or resolution status.
5. **Dynamic Platform Metrics:** Real-time counters showing Total Reports, Under Review, In Progress, and Resolved counts.
6. **Confidentiality Safeguard:** Automatic redaction of sensitive harassment/safety reports from the public feed.
7. **Emergency Helpline Directory:** Verified Indian emergency contacts (112, 181, 1098, 1930, 108, 101, 1915, SHe-Box).
8. **Municipal Staff Dashboard:** Passcode-protected administrative desk with instant status updates and remarks.
9. **Defensive Security & Rate Limiting:** Helmet security headers, Express rate limiting (100 req/15 min), input sanitization, and XSS escaping.

---

## 5. Technology Stack

- **Frontend:** HTML5, CSS3 (Custom Responsive Design, CSS Grid/Flexbox), Vanilla JavaScript (ES6+ Fetch API, DOM manipulation).
- **Backend:** Node.js (v18+ LTS), Express.js (v5 REST API, Helmet, Express Rate Limit, Multer).
- **Database:** Supabase PostgreSQL with `pgcrypto`, custom check constraints, updated_at triggers, and Row Level Security (RLS).
- **Version Control:** Git & GitHub.

---

## 6. Complete Folder Structure

```text
fixmystreet-civic-issue-reporter/
├── frontend/
│   ├── index.html          # Semantic HTML5 single-page structure
│   ├── styles.css          # Responsive design, theme variables, and layouts
│   └── app.js              # Vanilla JS controller, API client, and DOM handlers
├── backend/
│   ├── server.js           # Express application initialization & middleware
│   ├── supabase.js         # Supabase PostgreSQL client configuration
│   ├── routes/
│   │   └── reports.js      # REST API endpoints for civic reports
│   ├── middleware/
│   │   └── auth.js         # Admin authorization middleware (x-admin-key)
│   ├── package.json        # Node.js dependencies and run scripts
│   ├── package-lock.json   # Deterministic lockfile
│   ├── .env                # Private local environment variables (never committed)
│   ├── .env.example        # Environment variable template
│   └── .gitignore          # Backend ignore rules
├── database/
│   └── schema.sql          # PostgreSQL DDL schema, triggers, and demo seeds
├── .gitignore              # Root git ignore rules
└── README.md               # Master project documentation
```

---

## 7. Prerequisites & Software Installation

Before running the application, ensure the following free software is installed:

1. **Visual Studio Code:** [https://code.visualstudio.com/](https://code.visualstudio.com/)
2. **Node.js (LTS version):** [https://nodejs.org/](https://nodejs.org/) (Includes `npm`)
3. **Git:** [https://git-scm.com/](https://git-scm.com/)

Verify installations in your terminal:
```bash
node --version   # Should output v18.x or higher
npm --version    # Should output 9.x or higher
git --version    # Should output 2.x or higher
```

---

## 8. Supabase Database Setup

1. Sign up or log in at [https://supabase.com/](https://supabase.com/).
2. Click **New Project**, select your organization, name the project `fixmystreet`, choose a database password, and select your nearest geographic region.
3. Once the database initializes, click the **SQL Editor** tab (terminal icon) on the left sidebar.
4. Click **New query**, open `database/schema.sql` from this repository, copy its entire contents, and paste it into the editor.
5. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`). Verify that you see `Success. No rows returned`.
6. Open the **Table Editor** on the left sidebar. You will see the `reports` table populated with 3 initial seed reports!
7. Navigate to **Project Settings** (gear icon) → **API**.
   - Copy the **Project URL** (e.g., `https://xyzcompany.supabase.co`).
   - Copy the **service_role** secret key under **Project API keys** (do not copy the public `anon` key).

> [!CAUTION]
> The `service_role` key grants administrative database access and must only reside in `backend/.env`. Never commit it to GitHub or expose it in frontend code.

---

## 9. Environment Variable Configuration

Navigate to the `backend/` directory. Copy `.env.example` to create `.env`:

```bash
cd backend
cp .env.example .env
```
*(On Windows Command Prompt, use `copy .env.example .env`)*

Open `backend/.env` in VS Code and fill in your actual values:

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-secret-key
ADMIN_API_KEY=your-secure-admin-api-key-here
```

To generate a secure random `ADMIN_API_KEY`, run:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## 10. Dependency Installation & Starting the Application

1. Open your terminal in the `backend/` folder:
   ```bash
   cd backend
   npm install
   ```
2. Start the Express server:
   ```bash
   npm start
   ```
   *(For auto-reloading development mode, use `npm run dev`)*

3. Output confirms the server is active:
   ```text
   FixMyStreet server running at http://localhost:3000
   Health check: http://localhost:3000/api/health
   ```

4. Open your web browser and navigate to:
   ```text
   http://localhost:3000
   ```

---

## 11. REST API Specification

| Method | Endpoint | Description | Auth / Role |
|---|---|---|---|
| `GET` | `/api/health` | Service health status check | Public |
| `GET` | `/api/reports/stats` | Aggregated report statistics | Public |
| `GET` | `/api/reports` | List non-sensitive reports (`search`, `category`, `status`) | Public |
| `GET` | `/api/reports/track/:referenceId` | Look up status and municipal notes by reference code | Public |
| `POST` | `/api/reports` | Submit a new civic report with validation | Public (Rate-limited) |
| `GET` | `/api/reports/admin` | Retrieve all reports (including confidential safety issues) | Requires `x-admin-key` |
| `PATCH` | `/api/reports/:id/status` | Update issue milestone & official municipal notes | Requires `x-admin-key` |
| `DELETE`| `/api/reports/:id` | Remove invalid, abusive, or duplicate report | Requires `x-admin-key` |

---

## 12. Manual Verification Checklist

- [x] **Server Health:** Visit `http://localhost:3000/api/health` → returns `{"success": true}`.
- [x] **Community Feed:** Verify initial seed reports load properly with categories and status tags.
- [x] **Issue Submission:** Fill in the New Report form and click Submit → verify a modal appears with an `FSM-XXXXXXXX` reference ID.
- [x] **Track Issue:** Enter the newly generated reference code in the **Track Status** section → verify the visual 4-step progress stepper displays.
- [x] **Confidential Safety Guard:** Submit a report under category `Harassment or sexual offence` → verify it displays a safety notice and does NOT appear in the public feed.
- [x] **Staff Portal Authentication:** Click **Staff Portal** in navigation, enter your `ADMIN_API_KEY` → verify the admin table loads.
- [x] **Status Progression:** Change an issue's status to `In progress` with note `"Crew dispatched"` and click Save → re-track the reference code to confirm live updates.
- [x] **Spam Deletion:** Click Delete on an issue in the admin table → confirm it is removed from the database.

---

## 13. Git & GitHub Upload Instructions

From the root project folder (`fixmystreet-civic-issue-reporter/`), run the following commands:

```bash
# 1. Initialize Git repository
git init

# 2. Check that .env files and node_modules are ignored
git status

# 3. Stage all source files
git add .

# 4. Commit changes
git commit -m "Build FixMyStreet civic issue reporter master project"

# 5. Set main branch
git branch -M main

# 6. Link to your remote GitHub repository
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/fixmystreet-civic-issue-reporter.git

# 7. Push to GitHub
git push -u origin main
```

---

## 14. Security Considerations & Future Scope

- **Credential Isolation:** Supabase service-role keys and administrative secrets are strictly kept inside `backend/.env`.
- **XSS Mitigation:** All dynamic values rendered into the DOM are sanitized via `escapeHTML()`.
- **Public Feed Safety:** Harassment/offence reports are excluded from public queries at both the SQL query level and constraint level.
- **Future Improvements:**
  - Citizen SMS/Email notifications upon status change.
  - Interactive Leaflet/OpenStreetMap geographic pin placement.
  - Role-based municipal staff login via Supabase Auth with ward-level dispatching.
