-- Migration: Add location and cost columns to Match_Histories table
-- Run this SQL script on your database to add the new columns

ALTER TABLE public."Match_Histories"
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS cost NUMERIC;

-- Note: These columns are nullable, so existing rows will have NULL values
-- You can update existing rows if needed:
-- UPDATE public."Match_Histories" SET location = 'Unknown', cost = 0 WHERE location IS NULL;

