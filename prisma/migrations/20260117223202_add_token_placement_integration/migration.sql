/*
  Warnings:

  - You are about to drop the column `vertexId` on the `InfluenceToken` table. All the data in the column will be lost.
  - Added the required column `edgeId` to the `InfluenceToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN "currentTurnIndex" INTEGER;
ALTER TABLE "Game" ADD COLUMN "highlightedEdges" TEXT;
ALTER TABLE "Game" ADD COLUMN "placementTimeout" DATETIME;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "playerColor" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InfluenceToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "edgeId" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "orientation" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InfluenceToken_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InfluenceToken_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InfluenceToken" ("createdAt", "gameId", "id", "orientation", "playerId", "roundNumber", "tokenType") SELECT "createdAt", "gameId", "id", "orientation", "playerId", "roundNumber", "tokenType" FROM "InfluenceToken";
DROP TABLE "InfluenceToken";
ALTER TABLE "new_InfluenceToken" RENAME TO "InfluenceToken";
CREATE INDEX "InfluenceToken_gameId_idx" ON "InfluenceToken"("gameId");
CREATE UNIQUE INDEX "InfluenceToken_gameId_edgeId_key" ON "InfluenceToken"("gameId", "edgeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
