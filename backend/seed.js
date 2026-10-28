// backend/seed.js
// Seeds initial civic reports into the Supabase database.

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
require("dotenv").config();

const { supabase } = require("./supabase");

const demoReports = [
  {
    reference_id: "FSM-A1B2C3D4",
    category: "Roads & footpaths",
    title: "Deep pothole causing two-wheeler skids",
    description: "A dangerous 1.5-foot deep pothole has formed right before the pedestrian crossing near the metro pillar. Vehicles swerve abruptly to avoid it.",
    area: "MG Road, Ward 4",
    address: "Opposite City Library, Pillar 104",
    priority: "High",
    status: "In progress",
    sensitive: false,
    reporter_name: "Rajesh Kumar",
    contact: "+91 98765 43210"
  },
  {
    reference_id: "FSM-E5F6G7H8",
    category: "Garbage & sanitation",
    title: "Overflowing garbage dumpster creating foul smell",
    description: "Community bin has not been cleared for 4 days. Waste is spilling over onto the walkway, attracting stray animals and blocking pedestrians.",
    area: "Indira Nagar Sector 2",
    address: "Corner of 12th Cross and Main Market Road",
    priority: "Urgent",
    status: "Under review",
    sensitive: false,
    reporter_name: "Priya Sharma",
    contact: "+91 91234 56789"
  },
  {
    reference_id: "FSM-J9K0L1M2",
    category: "Water & utilities",
    title: "Non-functional streetlight creating dark hazard",
    description: "Three consecutive streetlights have been dead for over a week, leaving the corner lane completely dark and unsafe for evening commuters.",
    area: "Green Glen Layout",
    address: "Lane 3, behind Apex Hospital",
    priority: "Normal",
    status: "Resolved",
    sensitive: false,
    reporter_name: "Arun Patel",
    contact: null
  }
];

async function seedDatabase() {
  console.log("Seeding FixMyStreet Supabase database...");
  try {
    const { data, error } = await supabase
      .from("reports")
      .upsert(demoReports, { onConflict: "reference_id" })
      .select();

    if (error) {
      console.error("Seed failed:", error.message);
      process.exit(1);
    }

    console.log(`Successfully seeded ${data ? data.length : demoReports.length} civic reports:`);
    (data || demoReports).forEach(r => {
      console.log(`- [${r.reference_id}] ${r.status.toUpperCase()} | ${r.title} (${r.area})`);
    });
    console.log("Database ready!");
    process.exit(0);
  } catch (err) {
    console.error("Seed exception:", err);
    process.exit(1);
  }
}

seedDatabase();
