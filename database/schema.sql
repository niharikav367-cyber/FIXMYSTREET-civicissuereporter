-- ============================================================================
-- FixMyStreet — Civic Issue Reporter
-- PostgreSQL Database Schema for Supabase
-- ============================================================================

-- 1. Enable pgcrypto extension for cryptographic UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create the main civic reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN (
    'Roads & footpaths',
    'Garbage & sanitation',
    'Water & utilities',
    'Municipal services',
    'Public safety',
    'Harassment or sexual offence',
    'Pollution & noise',
    'Other civic complaint'
  )),
  title VARCHAR(120) NOT NULL CHECK (char_length(trim(title)) >= 4),
  description VARCHAR(3000) NOT NULL CHECK (char_length(trim(description)) >= 10),
  area VARCHAR(160) NOT NULL,
  address VARCHAR(250),
  priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'High', 'Urgent')),
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN (
    'Submitted',
    'Under review',
    'In progress',
    'Resolved',
    'Rejected'
  )),
  admin_notes TEXT,
  sensitive BOOLEAN NOT NULL DEFAULT false,
  reporter_name VARCHAR(100),
  contact VARCHAR(20),
  evidence_url TEXT,
  evidence_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Security check: Sensitive reports must have the sensitive flag enabled
  CONSTRAINT sensitive_category_matches CHECK (
    (category = 'Harassment or sexual offence' AND sensitive = true)
    OR (category <> 'Harassment or sexual offence' AND sensitive = false)
  )
);

-- Schema migration helpers for existing instances:
ALTER TABLE IF EXISTS public.reports ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE IF EXISTS public.reports ADD COLUMN IF NOT EXISTS evidence_url TEXT;
ALTER TABLE IF EXISTS public.reports ADD COLUMN IF NOT EXISTS evidence_path TEXT;

-- 3. Automatic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it already exists, then recreate
DROP TRIGGER IF EXISTS set_reports_updated_at ON public.reports;
CREATE TRIGGER set_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4. Create performance indexes for common search and filter queries
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON public.reports (created_at DESC);
CREATE INDEX IF NOT EXISTS reports_category_idx ON public.reports (category);
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status);
CREATE INDEX IF NOT EXISTS reports_area_idx ON public.reports (area);
CREATE INDEX IF NOT EXISTS reports_reference_idx ON public.reports (reference_id);

-- 5. Row Level Security (RLS) Configuration
-- We enable RLS and revoke direct anon/authenticated public table access.
-- The Express backend operates with the SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS
-- and enforces role-based access control and sanitization at the API level.
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reports FROM anon, authenticated;

-- ============================================================================
-- 6. Sample Initial Data (Demo civic reports for demonstration & testing)
-- ============================================================================

INSERT INTO public.reports (
  reference_id,
  category,
  title,
  description,
  area,
  address,
  priority,
  status,
  admin_notes,
  sensitive,
  reporter_name,
  contact
) VALUES
(
  'FSM-A1B2C3D4',
  'Roads & footpaths',
  'Deep pothole causing two-wheeler skids',
  'A dangerous 1.5-foot deep pothole has formed right before the pedestrian crossing near the metro pillar. Vehicles swerve abruptly to avoid it.',
  'MG Road, Ward 4',
  'Opposite City Library, Pillar 104',
  'High',
  'In progress',
  'Assigned to Ward 4 Road Maintenance crew. Asphalt patch work scheduled.',
  false,
  'Rajesh Kumar',
  '+91 98765 43210'
),
(
  'FSM-E5F6G7H8',
  'Garbage & sanitation',
  'Overflowing garbage dumpster creating foul smell',
  'Community bin has not been cleared for 4 days. Waste is spilling over onto the walkway, attracting stray animals and blocking pedestrians.',
  'Indira Nagar Sector 2',
  'Corner of 12th Cross and Main Market Road',
  'Urgent',
  'Under review',
  'Sanitation supervisor alerted. Secondary compactor vehicle dispatched.',
  false,
  'Priya Sharma',
  '+91 91234 56789'
),
(
  'FSM-J9K0L1M2',
  'Water & utilities',
  'Non-functional streetlight creating dark hazard',
  'Three consecutive streetlights have been dead for over a week, leaving the corner lane completely dark and unsafe for evening commuters.',
  'Green Glen Layout',
  'Lane 3, behind Apex Hospital',
  'Normal',
  'Resolved',
  'Electrician replaced damaged LED fixture and underground wiring on 26 Oct.',
  false,
  'Arun Patel',
  null
)
ON CONFLICT (reference_id) DO NOTHING;
