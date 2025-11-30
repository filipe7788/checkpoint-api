-- AlterTable
ALTER TABLE "public"."Game" ALTER COLUMN "igdbId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Game" ADD COLUMN IF NOT EXISTS "steamId" TEXT,
ADD COLUMN IF NOT EXISTS "xboxId" TEXT,
ADD COLUMN IF NOT EXISTS "psnId" TEXT,
ADD COLUMN IF NOT EXISTS "epicId" TEXT,
ADD COLUMN IF NOT EXISTS "nintendoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Game_steamId_key" ON "public"."Game"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Game_xboxId_key" ON "public"."Game"("xboxId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Game_psnId_key" ON "public"."Game"("psnId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Game_epicId_key" ON "public"."Game"("epicId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Game_nintendoId_key" ON "public"."Game"("nintendoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Game_steamId_idx" ON "public"."Game"("steamId");
