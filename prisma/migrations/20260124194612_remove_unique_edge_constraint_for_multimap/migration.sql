-- DropIndex
DROP INDEX "InfluenceToken_gameId_edgeId_key";

-- CreateIndex
CREATE INDEX "InfluenceToken_gameId_edgeId_idx" ON "InfluenceToken"("gameId", "edgeId");
