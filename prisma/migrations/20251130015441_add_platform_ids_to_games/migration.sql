-- AlterTable
ALTER TABLE "Game" ALTER COLUMN "igdbId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "steamId" TEXT,
ADD COLUMN "xboxId" TEXT,
ADD COLUMN "psnId" TEXT,
ADD COLUMN "epicId" TEXT,
ADD COLUMN "nintendoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Game_steamId_key" ON "Game"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_xboxId_key" ON "Game"("xboxId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_psnId_key" ON "Game"("psnId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_epicId_key" ON "Game"("epicId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_nintendoId_key" ON "Game"("nintendoId");

-- CreateIndex
CREATE INDEX "Game_steamId_idx" ON "Game"("steamId");
