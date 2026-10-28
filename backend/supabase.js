// backend/supabase.js
// Supabase Client Initialization for Backend Database Operations

const path = require("path");
// Ensure .env is loaded regardless of whether process is started from root or backend/
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("==========================================================");
  console.error("CRITICAL CONFIGURATION ERROR:");
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  console.error("Please configure your credentials before starting.");
  console.error("==========================================================");
}

// Create a Supabase client using the service-role key for authorized server queries
const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

module.exports = { supabase };
