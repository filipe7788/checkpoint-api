-- Migration: Add lastPlayedAt column to UserGame table
-- Run this on your EC2 database

-- Add the new column
ALTER TABLE "UserGame"
ADD COLUMN "lastPlayedAt" TIMESTAMP(3);

-- Add index for better query performance
CREATE INDEX "UserGame_lastPlayedAt_idx" ON "UserGame"("lastPlayedAt");

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'UserGame'
AND column_name = 'lastPlayedAt';
